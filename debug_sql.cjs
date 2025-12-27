const { Parser } = require('node-sql-parser');
const parser = new Parser();

const sql = `SELECT customer_id , first_name , last_name , email , created_at
WHERE status = 'active'
AND created_at >= '2025-01-01'
ORDER BY created_at DESC ;`;

try {
    const ast = parser.astify(sql, { database: 'mysql' });
    console.log('Parsed successfully (Unexpected):');
    console.log(JSON.stringify(ast, null, 2));
} catch (e) {
    console.log('Parser Error (Expected):');
    console.log(e.message);
}
