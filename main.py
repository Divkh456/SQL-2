import os
import sqlite3
import time
import traceback
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

app = FastAPI(title="NL-to-SQL SQLite Web Explorer")

# Workspace path - use current directory where app runs
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Helper to get all database files in the directory
def get_available_databases() -> List[str]:
    files = os.listdir(BASE_DIR)
    db_files = [f for f in files if f.endswith(('.db', '.sqlite', '.sqlite3'))]
    return db_files

# Helper to inspect schema of an SQLite database
def get_db_schema(db_name: str) -> Dict[str, Any]:
    db_path = os.path.join(BASE_DIR, db_name)
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get list of tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [row[0] for row in cursor.fetchall()]
        
        schema = {}
        for table in tables:
            # Get column info
            cursor.execute(f"PRAGMA table_info({table});")
            columns_info = cursor.fetchall()
            
            # Get foreign key info
            cursor.execute(f"PRAGMA foreign_key_list({table});")
            fk_info = cursor.fetchall()
            
            columns = []
            for col in columns_info:
                columns.append({
                    "name": col[1],
                    "type": col[2],
                    "notnull": bool(col[3]),
                    "primary_key": bool(col[5])
                })
                
            foreign_keys = []
            for fk in fk_info:
                foreign_keys.append({
                    "from_column": fk[3],
                    "to_table": fk[2],
                    "to_column": fk[4]
                })
                
            schema[table] = {
                "columns": columns,
                "foreign_keys": foreign_keys
            }
            
        conn.close()
        return schema
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read database schema: {str(e)}")

# Request models
class QueryRequest(BaseModel):
    database: str
    prompt: str

class ExecuteRequest(BaseModel):
    database: str
    sql: str

@app.get("/api/databases")
def list_databases():
    return {"databases": get_available_databases()}

@app.post("/api/upload")
async def upload_database(file: UploadFile = File(...)):
    if not file.filename.endswith(('.db', '.sqlite', '.sqlite3')):
        raise HTTPException(status_code=400, detail="Only .db, .sqlite, and .sqlite3 files are allowed")
    
    file_path = os.path.join(BASE_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        return {"filename": file.filename, "message": "Database uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload database: {str(e)}")

@app.get("/api/schema/{db_name}")
def get_schema(db_name: str):
    return get_db_schema(db_name)

@app.post("/api/query")
async def natural_language_query(
    request: QueryRequest, 
    x_gemini_api_key: Optional[str] = Header(None)
):
    # Determine API key to use
    api_key = x_gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400, 
            detail="Gemini API Key is missing. Please set the GEMINI_API_KEY environment variable or enter it in the settings panel."
        )

    # Get database schema to send to Gemini
    try:
        schema = get_db_schema(request.database)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Format schema representation for prompt
    schema_str = ""
    for table_name, table_info in schema.items():
        schema_str += f"Table: {table_name}\n"
        schema_str += "Columns:\n"
        for col in table_info["columns"]:
            pk_suffix = " (PRIMARY KEY)" if col["primary_key"] else ""
            nn_suffix = " (NOT NULL)" if col["notnull"] else ""
            schema_str += f"  - {col['name']} ({col['type']}){pk_suffix}{nn_suffix}\n"
        if table_info["foreign_keys"]:
            schema_str += "Foreign Keys:\n"
            for fk in table_info["foreign_keys"]:
                schema_str += f"  - {fk['from_column']} -> {fk['to_table']}({fk['to_column']})\n"
        schema_str += "\n"

    # Construct prompt
    system_instruction = (
        "You are an expert SQL analyst translator. Your job is to translate natural language questions "
        "into SQL queries for an SQLite database, and provide a clear, educational explanation of how the query works.\n\n"
        "Here is the database schema:\n"
        f"{schema_str}"
        "You MUST respond ONLY with a JSON object. Do not include markdown code block formatting (like ```json ... ```) in your output. Just output raw valid JSON.\n"
        "The JSON object must have exactly these two keys:\n"
        "1. \"sql\": The exact SQLite query as a string. Do not end it with a semicolon unless you want to. Ensure it is correct and executable on this schema.\n"
        "2. \"explanation\": A friendly, line-by-line explanation of what the query is doing, tailored for a 2nd year computer science student.\n\n"
        "Rules:\n"
        "- Generate SELECT queries only. DO NOT generate INSERT, UPDATE, DELETE, or DROP queries for safety reasons.\n"
        "- If the natural language question cannot be answered with the given schema, return a JSON with `\"sql\": \"\"` and a helpful explanation why it cannot be answered."
    )

    try:
        # Configure google-generativeai SDK with custom API key
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=system_instruction
        )
        response = model.generate_content(request.prompt)
        
        # Parse JSON output from Gemini
        import json
        text_response = response.text.strip()
        # Clean up any potential markdown wraps just in case
        if text_response.startswith("```"):
            lines = text_response.splitlines()
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                text_response = "\n".join(lines[1:-1])
        
        result_json = json.loads(text_response)
        generated_sql = result_json.get("sql", "")
        explanation = result_json.get("explanation", "")
        
    except google_exceptions.GoogleAPIError as e:
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to parse model response as JSON. Raw response: {response.text}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    # Execute SQL if query was generated
    if not generated_sql:
        return {
            "sql": "",
            "explanation": explanation,
            "columns": [],
            "rows": [],
            "execution_time_ms": 0,
            "error": "Could not generate query for the request."
        }

    execution_result = execute_sql_query(request.database, generated_sql)
    execution_result["explanation"] = explanation
    return execution_result

@app.post("/api/execute")
def execute_raw_sql(request: ExecuteRequest):
    # Safety check: block modifying commands
    sql_upper = request.sql.upper().strip()
    forbidden_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "REPLACE", "TRUNCATE"]
    for keyword in forbidden_keywords:
        if sql_upper.startswith(keyword) or f" {keyword} " in sql_upper:
            return {
                "columns": [],
                "rows": [],
                "execution_time_ms": 0,
                "error": f"Modification operation '{keyword}' is blocked for safety."
            }
            
    return execute_sql_query(request.database, request.sql)

def execute_sql_query(database: str, sql: str) -> Dict[str, Any]:
    db_path = os.path.join(BASE_DIR, database)
    if not os.path.exists(db_path):
        return {
            "columns": [],
            "rows": [],
            "execution_time_ms": 0,
            "error": "Database file not found."
        }

    start_time = time.time()
    try:
        conn = sqlite3.connect(db_path)
        # Return row objects that behave like dicts or tuples
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(sql)
        rows = cursor.fetchall()
        
        columns = [description[0] for description in cursor.description] if cursor.description else []
        
        # Convert sqlite3.Row objects to standard python lists/dicts for JSON serialization
        serialized_rows = []
        for row in rows:
            serialized_rows.append(list(row))
            
        execution_time = (time.time() - start_time) * 1000
        
        conn.close()
        return {
            "sql": sql,
            "columns": columns,
            "rows": serialized_rows,
            "execution_time_ms": round(execution_time, 2),
            "error": None
        }
    except Exception as e:
        execution_time = (time.time() - start_time) * 1000
        return {
            "sql": sql,
            "columns": [],
            "rows": [],
            "execution_time_ms": round(execution_time, 2),
            "error": str(e)
        }

# Serve frontend static files
# Make sure static directory exists
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
