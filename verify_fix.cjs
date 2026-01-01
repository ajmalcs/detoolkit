const { Parser } = require('node-sql-parser');
const parser = new Parser();

const sql = `
SELECT * FROM t 
WHERE 
    segment IN ('active', 'loyal') 
    AND region IS NULL 
    AND created_at >= DATEADD(day, -30, CURRENT_DATE)
`;

const exprToString = (expr) => {
    if (!expr) return ''

    if (expr.type === 'binary_expr') {
        return `${exprToString(expr.left)} ${expr.operator} ${exprToString(expr.right)}`
    }
    if (expr.type === 'column_ref') {
        return expr.table ? `${expr.table}.${expr.column}` : expr.column
    }
    if (expr.type === 'single_quote_string') {
        return `'${expr.value}'`
    }
    if (expr.type === 'number') {
        return expr.value
    }
    if (expr.type === 'bool') {
        return expr.value ? 'TRUE' : 'FALSE'
    }
    if (expr.type === 'null') {
        return 'NULL'
    }
    if (expr.type === 'expr_list') {
        return `(${expr.value.map((e) => exprToString(e)).join(', ')})`
    }
    if (expr.type === 'function') {
        const funcName = expr.name.name.map((n) => n.value).join('.')
        const args = expr.args ? exprToString(expr.args) : '()'
        return `${funcName}${args}`
    }

    return '?'
}

try {
    const ast = parser.astify(sql, { database: 'transactsql' });
    // AST is a select object
    // traverse to where
    const where = ast.where;

    // We want to simulate what the component does: 
    // extractFilters(stmt.where)
    // It recursively stringifies binary_expr conditions

    const results = [];
    const extractFilters = (expr) => {
        if (!expr) return

        if (expr.type === 'binary_expr') {
            // Check if it's a logical operator to recurse
            if (['AND', 'OR'].includes(expr.operator)) {
                if (expr.left) extractFilters(expr.left)
                if (expr.right) extractFilters(expr.right)
            } else {
                // It's a condition, stringify it
                results.push(exprToString(expr))
            }
        }
    }

    extractFilters(where);

    console.log('Extracted Filters:');
    results.forEach(r => console.log(r));

} catch (e) {
    console.error(e);
}
