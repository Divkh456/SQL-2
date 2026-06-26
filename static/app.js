// State Management
let activeDb = "";
let dbSchema = {};
let activeChart = null;

// Preset suggestions for the sample database
const SAMPLE_SUGGESTIONS = [
    "Show me all customers from USA",
    "List products that are out of stock",
    "What category generates the most revenue?",
    "Find top 3 customers by spending",
    "Show monthly total sales"
];

const GENERIC_SUGGESTIONS = [
    "Show first 5 rows",
    "Count rows in the table",
    "Show table schema info"
];

// Elements
const dbSelect = document.getElementById("db-select");
const uploadTrigger = document.getElementById("upload-trigger");
const dbFileInput = document.getElementById("db-file-input");
const schemaBrowser = document.getElementById("schema-browser");
const apiKeyInput = document.getElementById("api-key-input");
const saveKeyBtn = document.getElementById("save-key-btn");
const promptInput = document.getElementById("prompt-input");
const chipsContainer = document.getElementById("suggestions-chips");
const executeBtn = document.getElementById("execute-btn");
const querySpinner = document.getElementById("query-spinner");
const clearBtn = document.getElementById("clear-btn");

const sqlDisplayCard = document.getElementById("sql-display-card");
const sqlCode = document.getElementById("sql-code");
const sqlExplanation = document.getElementById("sql-explanation");
const copySqlBtn = document.getElementById("copy-sql-btn");

const resultsDisplayCard = document.getElementById("results-display-card");
const rowCountEl = document.getElementById("row-count");
const execTimeEl = document.getElementById("exec-time");
const resultsTable = document.getElementById("results-table");
const tableHeaders = document.getElementById("table-headers");
const tableBody = document.getElementById("table-body");

const chartTabBtn = document.getElementById("chart-tab-btn");
const chartTypeSelect = document.getElementById("chart-type");
const resultsChartCanvas = document.getElementById("results-chart");

const errorPanel = document.getElementById("error-panel");
const errorMessage = document.getElementById("error-message");

const manualSqlHeader = document.getElementById("manual-sql-header");
const manualSqlContent = document.getElementById("manual-sql-content");
const manualSqlInput = document.getElementById("manual-sql-input");
const runManualBtn = document.getElementById("run-manual-btn");

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Load saved API Key
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }
    
    // Fetch Databases list
    loadDatabases();

    // Event Listeners
    saveKeyBtn.addEventListener("click", saveApiKey);
    dbSelect.addEventListener("change", (e) => {
        activeDb = e.target.value;
        loadSchema(activeDb);
    });

    // File Upload
    uploadTrigger.addEventListener("click", () => dbFileInput.click());
    dbFileInput.addEventListener("change", handleFileUpload);

    // Execute Button
    executeBtn.addEventListener("click", runNaturalLanguageQuery);
    clearBtn.addEventListener("click", () => {
        promptInput.value = "";
    });

    // Copy SQL
    copySqlBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(sqlCode.textContent);
        const originalText = copySqlBtn.textContent;
        copySqlBtn.textContent = "✅ Copied!";
        setTimeout(() => {
            copySqlBtn.textContent = originalText;
        }, 2000);
    });

    // Tab Navigation
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const targetTab = btn.getAttribute("data-tab");
            document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
            document.getElementById(targetTab).classList.add("active");
            
            // Re-render chart if switching to chart tab to solve dimensions issues
            if (targetTab === "chart-tab" && activeChart) {
                activeChart.resize();
            }
        });
    });

    // Collapsible manual SQL editor
    manualSqlHeader.addEventListener("click", () => {
        manualSqlHeader.classList.toggle("expanded");
        if (manualSqlContent.style.display === "none") {
            manualSqlContent.style.display = "block";
        } else {
            manualSqlContent.style.display = "none";
        }
    });

    runManualBtn.addEventListener("click", runManualQuery);
    chartTypeSelect.addEventListener("change", () => {
        if (lastQueryData) {
            renderChart(lastQueryData);
        }
    });
});

// Save API key to local storage
function saveApiKey() {
    const key = apiKeyInput.value.trim();
    localStorage.setItem("gemini_api_key", key);
    alert("Gemini API Key saved locally. It will be used for subsequent requests.");
}

// Fetch available databases
async function loadDatabases() {
    try {
        const response = await fetch("/api/databases");
        const data = await response.json();
        
        dbSelect.innerHTML = "";
        
        if (data.databases.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No databases uploaded";
            dbSelect.appendChild(option);
            return;
        }

        data.databases.forEach(db => {
            const option = document.createElement("option");
            option.value = db;
            option.textContent = db;
            dbSelect.appendChild(option);
        });

        // Default to sample.db if available
        if (data.databases.includes("sample.db")) {
            dbSelect.value = "sample.db";
        } else {
            dbSelect.selectedIndex = 0;
        }

        activeDb = dbSelect.value;
        loadSchema(activeDb);
        
    } catch (err) {
        console.error("Error loading databases:", err);
    }
}

// Upload custom database file
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
        uploadTrigger.innerHTML = `<span>⏳ Uploading...</span>`;
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Upload failed");
        }

        const data = await response.json();
        alert(data.message);
        
        // Refresh databases and select new one
        await loadDatabases();
        dbSelect.value = data.filename;
        activeDb = data.filename;
        loadSchema(activeDb);
    } catch (err) {
        alert("Upload error: " + err.message);
    } finally {
        uploadTrigger.innerHTML = `<span>📤 Upload SQLite DB</span>`;
        dbFileInput.value = ""; // Reset file input
    }
}

// Load database schema info
async function loadSchema(dbName) {
    if (!dbName) {
        schemaBrowser.innerHTML = '<div class="empty-state">Select a database to browse.</div>';
        return;
    }

    try {
        schemaBrowser.innerHTML = '<div class="empty-state">⏳ Loading schema...</div>';
        const response = await fetch(`/api/schema/${dbName}`);
        if (!response.ok) throw new Error("Could not load schema");
        
        dbSchema = await response.json();
        renderSchemaBrowser(dbSchema);
        setupSuggestions(dbName);
    } catch (err) {
        schemaBrowser.innerHTML = `<div class="empty-state" style="color: var(--danger)">Error: ${err.message}</div>`;
    }
}

// Render the schema browser items
function renderSchemaBrowser(schema) {
    schemaBrowser.innerHTML = "";
    const tables = Object.keys(schema);

    if (tables.length === 0) {
        schemaBrowser.innerHTML = '<div class="empty-state">No tables in this database.</div>';
        return;
    }

    tables.forEach(table => {
        const tableNode = document.createElement("div");
        tableNode.className = "table-node";

        const headerNode = document.createElement("div");
        headerNode.className = "table-header-node";
        headerNode.textContent = table;

        const columnsList = document.createElement("div");
        columnsList.className = "columns-list";

        schema[table].columns.forEach(col => {
            const colItem = document.createElement("div");
            colItem.className = "column-item";

            const nameSpan = document.createElement("span");
            nameSpan.className = "col-name";
            nameSpan.textContent = col.name;
            if (col.primary_key) {
                nameSpan.innerHTML += ' <span class="col-pk">🔑 PK</span>';
            }

            const typeSpan = document.createElement("span");
            typeSpan.className = "col-type";
            typeSpan.textContent = col.type.toLowerCase();

            colItem.appendChild(nameSpan);
            colItem.appendChild(typeSpan);
            columnsList.appendChild(colItem);
        });

        // Toggle columns visibility
        headerNode.addEventListener("click", () => {
            headerNode.classList.toggle("expanded");
            tableNode.classList.toggle("active-table");
            const isVisible = columnsList.style.display === "block";
            columnsList.style.display = isVisible ? "none" : "block";
        });

        tableNode.appendChild(headerNode);
        tableNode.appendChild(columnsList);
        schemaBrowser.appendChild(tableNode);
    });
}

// Setup suggestions chips based on active db
function setupSuggestions(dbName) {
    chipsContainer.innerHTML = "";
    
    // Choose which suggestions to show
    const suggestions = (dbName === "sample.db") ? SAMPLE_SUGGESTIONS : GENERIC_SUGGESTIONS;

    suggestions.forEach(suggestion => {
        const chip = document.createElement("button");
        chip.className = "chip";
        chip.textContent = suggestion;
        chip.addEventListener("click", () => {
            promptInput.value = suggestion;
            runNaturalLanguageQuery();
        });
        chipsContainer.appendChild(chip);
    });
}

// Store last result data for chart type changes
let lastQueryData = null;

// Run Natural Language to SQL
async function runNaturalLanguageQuery() {
    const promptText = promptInput.value.trim();
    if (!promptText) return;

    const apiKey = apiKeyInput.value.trim() || localStorage.getItem("gemini_api_key");
    if (!apiKey) {
        alert("Please set your Gemini API Key in the top right box first.");
        return;
    }

    // Hide previous panels
    sqlDisplayCard.style.display = "none";
    resultsDisplayCard.style.display = "none";
    errorPanel.style.display = "none";

    // Disable button & show spinner
    executeBtn.disabled = true;
    querySpinner.style.display = "inline-block";

    try {
        const response = await fetch("/api/query", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Gemini-API-Key": apiKey
            },
            body: JSON.stringify({
                database: activeDb,
                prompt: promptText
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Server failed to process query");
        }

        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            // Even if SQL execution failed, we can still show the generated SQL
            if (data.sql) {
                showGeneratedSql(data.sql, data.explanation);
            }
            return;
        }

        lastQueryData = data;
        
        // Show SQL query
        showGeneratedSql(data.sql, data.explanation);
        
        // Show Results Table
        renderTable(data);
        
        // Render Chart if valid
        renderChart(data);

        resultsDisplayCard.style.display = "block";
    } catch (err) {
        showError(err.message);
    } finally {
        executeBtn.disabled = false;
        querySpinner.style.display = "none";
    }
}

// Run Manual SQL
async function runManualQuery() {
    const sqlText = manualSqlInput.value.trim();
    if (!sqlText) return;

    resultsDisplayCard.style.display = "none";
    errorPanel.style.display = "none";

    try {
        const response = await fetch("/api/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                database: activeDb,
                sql: sqlText
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to execute SQL");
        }

        const data = await response.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        lastQueryData = data;

        // Render table
        renderTable(data);

        // Render chart
        renderChart(data);

        resultsDisplayCard.style.display = "block";
    } catch (err) {
        showError(err.message);
    }
}

// Helper: Show SQL and explanation panel
function showGeneratedSql(sql, explanation) {
    sqlCode.textContent = sql;
    sqlExplanation.textContent = explanation || "No explanation provided.";
    sqlDisplayCard.style.display = "block";
}

// Helper: Show error details
function showError(msg) {
    errorMessage.textContent = msg;
    errorPanel.style.display = "flex";
}

// Render dynamic results table
function renderTable(data) {
    rowCountEl.textContent = `${data.rows.length} rows`;
    execTimeEl.textContent = `${data.execution_time_ms}ms`;

    tableHeaders.innerHTML = "";
    tableBody.innerHTML = "";

    if (data.columns.length === 0) {
        tableHeaders.innerHTML = "<th>Result</th>";
        tableBody.innerHTML = "<tr><td>Empty or no schema returned</td></tr>";
        return;
    }

    // Headers
    data.columns.forEach(col => {
        const th = document.createElement("th");
        th.textContent = col;
        tableHeaders.appendChild(th);
    });

    // Rows
    if (data.rows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = data.columns.length;
        td.className = "empty-state";
        td.textContent = "No records matched your search query.";
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
    }

    data.rows.forEach(row => {
        const tr = document.createElement("tr");
        row.forEach(val => {
            const td = document.createElement("td");
            // Format floats nicely
            if (typeof val === 'number' && !Number.isInteger(val)) {
                td.textContent = val.toFixed(2);
            } else {
                td.textContent = val !== null ? val : "NULL";
            }
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

// Charting Engine
function renderChart(data) {
    // Destroy existing chart
    if (activeChart) {
        activeChart.destroy();
        activeChart = null;
    }

    const columns = data.columns;
    const rows = data.rows;

    // Check if we can build a chart (minimum 2 columns, at least 1 numeric, 1 label)
    if (columns.length < 2 || rows.length === 0) {
        disableChartTab("Table has too few columns or no rows to visualize.");
        return;
    }

    // Analyze data types of columns in the first row
    const firstRow = rows[0];
    let labelColIndex = -1;
    let valueColIndices = [];

    firstRow.forEach((val, idx) => {
        // Check if value is numeric (or castable to numeric and not empty)
        const isNumeric = typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val));
        if (isNumeric) {
            valueColIndices.push(idx);
        } else if (labelColIndex === -1 && typeof val === 'string') {
            labelColIndex = idx;
        }
    });

    // Fallback: If no explicit string label is found, use the first non-numeric column or column 0
    if (labelColIndex === -1) {
        for (let i = 0; i < firstRow.length; i++) {
            if (!valueColIndices.includes(i)) {
                labelColIndex = i;
                break;
            }
        }
    }
    if (labelColIndex === -1) labelColIndex = 0;

    // Filter value columns: ensure value cols do not contain the label column
    valueColIndices = valueColIndices.filter(idx => idx !== labelColIndex);

    if (valueColIndices.length === 0) {
        disableChartTab("No numeric columns found for rendering a chart.");
        return;
    }

    // Enable chart tab
    chartTabBtn.disabled = false;
    chartTabBtn.style.opacity = "1";
    chartTabBtn.style.cursor = "pointer";
    chartTabBtn.title = "";

    // Extract Chart Data
    const labels = rows.map(row => String(row[labelColIndex]));
    const chartType = chartTypeSelect.value;
    
    // Curated Chart Colors
    const palette = [
        'rgba(99, 102, 241, 0.7)',  // Indigo
        'rgba(217, 70, 239, 0.7)',  // Fuchsia
        'rgba(16, 185, 129, 0.7)',  // Emerald
        'rgba(245, 158, 11, 0.7)',  // Amber
        'rgba(239, 68, 68, 0.7)',   // Red
        'rgba(59, 130, 246, 0.7)'   // Blue
    ];
    const borderPalette = [
        'rgb(99, 102, 241)',
        'rgb(217, 70, 239)',
        'rgb(16, 185, 129)',
        'rgb(245, 158, 11)',
        'rgb(239, 68, 68)',
        'rgb(59, 130, 246)'
    ];

    const datasets = valueColIndices.map((valIdx, dsIdx) => {
        const colName = columns[valIdx];
        const dataValues = rows.map(row => {
            const val = row[valIdx];
            return typeof val === 'number' ? val : parseFloat(val);
        });

        // Use circular indexing for colors
        const colorIdx = dsIdx % palette.length;
        const bgColors = (chartType === 'pie' || chartType === 'doughnut') 
            ? palette.slice(0, rows.length) 
            : palette[colorIdx];
        const borderColors = (chartType === 'pie' || chartType === 'doughnut') 
            ? borderPalette.slice(0, rows.length) 
            : borderPalette[colorIdx];

        return {
            label: colName,
            data: dataValues,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            fill: chartType === 'line' ? 'origin' : false
        };
    });

    // Create the Chart
    const ctx = resultsChartCanvas.getContext('2d');
    activeChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#f3f4f6',
                        font: { family: 'Inter' }
                    }
                }
            },
            scales: (chartType === 'pie' || chartType === 'doughnut') ? {} : {
                x: {
                    ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    ticks: { color: '#9ca3af', font: { family: 'Inter', size: 11 } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                }
            }
        }
    });
}

function disableChartTab(reason) {
    chartTabBtn.disabled = true;
    chartTabBtn.style.opacity = "0.4";
    chartTabBtn.style.cursor = "not-allowed";
    chartTabBtn.title = reason;
    
    // Switch to table tab if currently on chart tab
    if (chartTabBtn.classList.contains("active")) {
        document.querySelector(".tab-btn[data-tab='table-tab']").click();
    }
}
