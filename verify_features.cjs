const { faker } = require('@faker-js/faker');

// --- 1. Auto Fix Logic Verification ---
console.log("--- 1. Testing Auto-Fix Logic ---");
const brokenSql = "CREATE TABLE users ( id INT, name VARCHAR(100), );"; // Trailing comma, extra semi?
console.log("Broken SQL:", brokenSql);

let fixed = brokenSql.trim();
// 1. Remove trailing comma before )
fixed = fixed.replace(/,\s*\)/g, '\n)');
// 2. Ensure Semicolon
if (!fixed.endsWith(';')) fixed += ';';

console.log("Fixed SQL:", fixed);

if (fixed.includes("name VARCHAR(100)\n)") && fixed.endsWith(";")) {
    console.log("✅ Auto-Fix Logic: PASSED");
} else {
    console.error("❌ Auto-Fix Logic: FAILED");
    console.log("Expected removal of trailing comma.");
}
console.log("\n");

// --- 2. Dialect Generation Verification ---
console.log("--- 2. Testing Dialect Generation ---");

const cols = [
    { name: 'id', type: 'int' },
    { name: 'is_active', type: 'boolean' },
    { name: 'created_at', type: 'timestamp' }
];

const row = {
    id: 1,
    is_active: true,
    created_at: new Date('2023-01-01T12:00:00Z')
};

function generateSql(dialect, row, cols, tableName) {
    const values = cols.map(c => {
        const val = row[c.name];
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'boolean') {
            if (dialect === 'mysql' || dialect === 'mssql' || dialect === 'synapse') return val ? 1 : 0;
            return val ? 'TRUE' : 'FALSE'; // Standard/Postgres/BigQuery
        }
        if (val instanceof Date) {
            return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
        }
        return val;
    }).join(', ');

    let qL = '', qR = '';
    if (dialect === 'mysql' || dialect === 'bigquery') { qL = '`'; qR = '`'; }
    else if (dialect === 'mssql' || dialect === 'synapse') { qL = '['; qR = ']'; }
    else if (dialect === 'postgres') { qL = '"'; qR = '"'; }

    const colList = cols.map(c => `${qL}${c.name}${qR}`).join(', ');
    return `INSERT INTO ${qL}${tableName}${qR} (${colList}) VALUES (${values});`;
}

// Test Synapse
const synapseSql = generateSql('synapse', row, cols, 'users');
console.log("[Synapse] Output:", synapseSql);
if (synapseSql.includes("[id]") && synapseSql.includes("VALUES (1, 1,")) {
    console.log("✅ Synapse Logic: PASSED (Brackets used, boolean is 1)");
} else {
    console.error("❌ Synapse Logic: FAILED");
}

// Test BigQuery
const bqSql = generateSql('bigquery', row, cols, 'users');
console.log("[BigQuery] Output:", bqSql);
if (bqSql.includes("`id`") && bqSql.includes("VALUES (1, TRUE,")) {
    console.log("✅ BigQuery Logic: PASSED (Backticks used, boolean is TRUE)");
} else {
    console.error("❌ BigQuery Logic: FAILED");
}
