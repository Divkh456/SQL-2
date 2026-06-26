# NL-to-SQL SQLite Web Explorer 📊

Welcome! The **NL-to-SQL SQLite Web Explorer** is a lightweight, responsive web application designed for students and developers. It allows you to load any SQLite database, ask analytical questions in plain English, and instantly receive generated SQL queries, detailed explanations, formatted data tables, and interactive visualizations.

This project uses **Python (FastAPI)** on the backend, **Vanilla HTML/CSS/JS** on the frontend, and the **Google Gemini API** (`gemini-2.5-flash`) for translating natural language into SQL queries.

---

## Key Features

1. **Natural Language to SQL**: Input questions like *"What is our monthly revenue?"* or *"List top 5 customers from USA"* and see them converted to SQL.
2. **Interactive Explanations**: The AI breaks down the generated SQL query clause-by-clause, making it an excellent tool for learning SQL.
3. **Database Schema Browser**: Inspect tables, column types, and primary/foreign keys in the sidebar.
4. **Auto-Visualization**: Automatically builds Bar, Line, Pie, or Doughnut charts (using Chart.js) when results contain labels and numeric values.
5. **Interactive DB Upload**: Upload custom `.db` or `.sqlite` files and browse/query them on the fly.
6. **Built-in Security**: Prevents SQL injections and database modification queries (`INSERT`, `UPDATE`, `DELETE`, `DROP`) to keep data safe.
7. **Manual SQL Editor**: Run raw SQL statements directly in the app.

---

## File Structure

```
sqlite-web-explorer/
├── main.py             # FastAPI backend (NL translation, query execution, routing)
├── init_db.py          # Script to generate the pre-populated sample database
├── requirements.txt    # Python dependencies
├── sample.db           # Pre-loaded SQLite database (created via init_db.py)
├── .gitignore          # Excluded files for version control
└── static/
    ├── index.html      # Main dashboard frontend interface
    ├── styles.css      # Custom modern dark-theme styles and animations
    └── app.js          # Client-side API calls and Chart.js integration
```

---

## Getting Started

### 1. Install Dependencies
Make sure you have Python 3.10+ installed. Install the required libraries:
```bash
pip install -r requirements.txt
```

### 2. Generate the Sample Database
Initialize the pre-populated e-commerce database:
```bash
python init_db.py
```

### 3. Launch the Server
Start the FastAPI server:
```bash
python main.py
```
Or use Uvicorn directly:
```bash
uvicorn main:app --reload
```

### 4. Open in Browser
Visit **[http://localhost:8000](http://localhost:8000)** in your web browser.

---

## Linking to Your GitHub Repository

To link this local project to your GitHub account (`lakchchayam` / Divya):

1. Go to [GitHub](https://github.com/) and create a new, empty repository named `sqlite-web-explorer` (do not initialize with README or gitignore).
2. Open your terminal in this directory and run the following commands:
   ```bash
   git add .
   git commit -m "Initial commit of NL-to-SQL SQLite Web Explorer"
   git branch -M main
   git remote add origin https://github.com/lakchchayam/sqlite-web-explorer.git
   git push -u origin main
   ```

---

## Educational Value
* Learn how **FastAPI** handles file uploads and JSON APIs.
* Understand how to query schema metadata from SQLite's internal tables.
* Master integration with the **Google Gemini SDK** (`google-genai`).
* Experience how **Chart.js** parses unstructured query columns to produce stunning charts dynamically.
