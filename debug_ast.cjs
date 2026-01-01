const { Parser } = require('node-sql-parser');
const parser = new Parser();

const sql = `
SELECT * FROM t 
WHERE 
    segment IN ('active', 'loyal') 
    AND region IS NULL 
    AND created_at >= DATEADD(day, -30, CURRENT_DATE)
`;

try {
    const ast = parser.astify(sql, { database: 'transactsql' });
    console.log(JSON.stringify(ast, null, 2));
} catch (e) {
    console.error(e);
}
