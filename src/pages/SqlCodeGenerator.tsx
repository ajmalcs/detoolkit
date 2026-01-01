import { useState, useMemo } from 'react'
import { Code2, Download, Minimize2, Maximize2, Copy, Plus, Trash2, Info } from 'lucide-react'
import { Button } from '../components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'
import { CodeEditor } from '../components/ui/code-editor'
import { useNavigate } from 'react-router-dom'

interface Column { id: string; name: string; alias?: string }
interface WhereCondition { id: string; column: string; operator: string; value: string; logic: 'AND' | 'OR' }
interface Join { id: string; type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'; table: string; alias?: string; onConditions: JoinCondition[] }
interface JoinCondition { id: string; leftColumn: string; operator: string; rightColumn: string; logic: 'AND' | 'OR' }
interface GroupBy { columns: string[]; havingConditions: WhereCondition[] }
interface CTE { id: string; name: string; query: string }
interface WindowFunc { id: string; function: 'ROW_NUMBER' | 'RANK' | 'DENSE_RANK' | 'LAG' | 'LEAD' | 'SUM' | 'AVG' | 'COUNT'; column: string; alias: string; partitionBy: string; orderBy: string; orderDirection: 'ASC' | 'DESC' }
interface UnionQuery { id: string; type: 'UNION' | 'UNION ALL'; query: string }

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL']
const JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT', 'FULL'] as const
const WINDOW_FUNCS = ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'SUM', 'AVG', 'COUNT'] as const

export default function SqlCodeGenerator() {
    const navigate = useNavigate()
    const [dialect, setDialect] = useState('mssql')
    const [queryType, setQueryType] = useState('SELECT')
    const [tableName, setTableName] = useState('users')
    const [tableAlias, setTableAlias] = useState('')
    const [selectedColumns, setSelectedColumns] = useState<Column[]>([{ id: '1', name: '*' }])
    const [distinct, setDistinct] = useState(false)
    const [ctes, setCtes] = useState<CTE[]>([])
    const [windowFuncs, setWindowFuncs] = useState<WindowFunc[]>([])
    const [joins, setJoins] = useState<Join[]>([])
    const [whereConditions, setWhereConditions] = useState<WhereCondition[]>([])
    const [groupBy, setGroupBy] = useState<GroupBy>({ columns: [], havingConditions: [] })
    const [unionQueries, setUnionQueries] = useState<UnionQuery[]>([])
    const [limit, setLimit] = useState('')
    const [orderBy, setOrderBy] = useState('')
    const [orderDirection, setOrderDirection] = useState<'ASC' | 'DESC'>('ASC')
    const [isFullScreen, setIsFullScreen] = useState(false)

    const generatedSql = useMemo(() => {
        if (queryType === 'SELECT') {
            let sql = ''

            // CTEs
            if (ctes.length > 0) {
                sql += 'WITH '
                sql += ctes.map((cte, idx) => {
                    return `${idx > 0 ? ', ' : ''}${cte.name} AS (\n  ${cte.query.trim()}\n)`
                }).join('\n')
                sql += '\n'
            }

            sql += 'SELECT '
            if (distinct) sql += 'DISTINCT '

            // Columns with Window Functions
            const allCols = [...selectedColumns]
            if (windowFuncs.length > 0) {
                windowFuncs.forEach(wf => {
                    let funcSql = `${wf.function}(`
                    // Only include column for aggregate and offset functions
                    if (wf.function === 'LAG' || wf.function === 'LEAD') {
                        funcSql += wf.column || 'NULL'
                    } else if (wf.function === 'SUM' || wf.function === 'AVG' || wf.function === 'COUNT') {
                        funcSql += wf.column || '*'
                    }
                    // ROW_NUMBER, RANK, DENSE_RANK don't take column arguments
                    funcSql += `) OVER (`
                    if (wf.partitionBy) funcSql += `PARTITION BY ${wf.partitionBy} `
                    if (wf.orderBy) funcSql += `ORDER BY ${wf.orderBy} ${wf.orderDirection}`
                    funcSql += `) AS ${wf.alias}`
                    allCols.push({ id: wf.id, name: funcSql, alias: '' })
                })
            }

            // Check if we have only * or no columns (excluding window funcs which were appended)
            const regularCols = selectedColumns.filter(c => c.name !== '*')
            const hasWildcard = selectedColumns.some(c => c.name === '*')
            const windowFuncsCols = allCols.slice(selectedColumns.length) // Window funcs are appended after

            if (selectedColumns.length === 0 || (hasWildcard && regularCols.length === 0 && windowFuncsCols.length === 0)) {
                sql += '*'
            } else if (hasWildcard && windowFuncsCols.length > 0) {
                // Show * plus window functions
                const windowSql = windowFuncsCols.map(c => c.name).join(', ')
                sql += `*, ${windowSql}`
            } else {
                sql += allCols.map(c => {
                    if (c.alias && !c.name.includes(' AS ')) return `${c.name} AS ${c.alias}`
                    return c.name
                }).join(', ')
            }

            sql += `\nFROM ${tableName}`
            if (tableAlias) sql += ` ${tableAlias}`

            // JOINs
            if (joins.length > 0) {
                joins.forEach(join => {
                    sql += `\n${join.type} JOIN ${join.table}`
                    if (join.alias) sql += ` ${join.alias}`
                    if (join.onConditions.length > 0) {
                        sql += ' ON '
                        join.onConditions.forEach((cond, idx) => {
                            if (idx > 0) sql += ` ${cond.logic} `
                            sql += `${cond.leftColumn} ${cond.operator} ${cond.rightColumn}`
                        })
                    }
                })
            }

            // WHERE
            if (whereConditions.length > 0) {
                sql += '\nWHERE '
                whereConditions.forEach((cond, idx) => {
                    if (idx > 0) sql += ` ${cond.logic} `
                    if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
                        sql += `${cond.column} ${cond.operator}`
                    } else if (cond.operator === 'IN') {
                        sql += `${cond.column} IN (${cond.value})`
                    } else if (cond.operator === 'LIKE') {
                        sql += `${cond.column} LIKE '${cond.value}'`
                    } else {
                        sql += `${cond.column} ${cond.operator} '${cond.value}'`
                    }
                })
            }

            // GROUP BY
            if (groupBy.columns.length > 0) {
                sql += `\nGROUP BY ${groupBy.columns.join(', ')}`
                if (groupBy.havingConditions.length > 0) {
                    const validConditions = groupBy.havingConditions.filter(c => c.column && c.column.trim())
                    if (validConditions.length > 0) {
                        sql += '\nHAVING '
                        validConditions.forEach((cond, idx) => {
                            if (idx > 0) sql += ` ${cond.logic} `
                            if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
                                sql += `${cond.column} ${cond.operator}`
                            } else if (cond.operator === 'IN') {
                                sql += `${cond.column} IN (${cond.value})`
                            } else if (cond.operator === 'LIKE') {
                                sql += `${cond.column} LIKE '${cond.value}'`
                            } else {
                                // Check if value is numeric - don't wrap in quotes
                                const isNumeric = !isNaN(Number(cond.value)) && cond.value.trim() !== ''
                                if (isNumeric) {
                                    sql += `${cond.column} ${cond.operator} ${cond.value}`
                                } else {
                                    sql += `${cond.column} ${cond.operator} '${cond.value}'`
                                }
                            }
                        })
                    }
                }
            }

            // ORDER BY
            if (orderBy) sql += `\nORDER BY ${orderBy} ${orderDirection}`

            // LIMIT
            if (limit) sql += `\nLIMIT ${limit}`

            sql += ';'

            // UNION Queries
            if (unionQueries.length > 0) {
                sql = sql.replace(/;$/, '') // Remove trailing semicolon only
                unionQueries.forEach(uq => {
                    sql += `\n${uq.type}\n${uq.query.trim()}`
                })
                sql += ';'
            }

            return sql
        }

        if (queryType === 'INSERT') {
            let sql = `INSERT INTO ${tableName}`
            const validColumns = selectedColumns.filter(c => c.name && c.name !== '*')
            if (validColumns.length > 0) {
                sql += ` (${validColumns.map(c => c.name).join(', ')})`
                sql += `\nVALUES (${validColumns.map(c => c.alias || `'${c.name}_value'`).join(', ')})`
            } else {
                sql += ' (column1, column2)\nVALUES (value1, value2)'
            }
            sql += ';'
            return sql
        }

        if (queryType === 'UPDATE') {
            let sql = `UPDATE ${tableName}`
            const validColumns = selectedColumns.filter(c => c.name && c.name !== '*')
            if (validColumns.length > 0) {
                sql += '\nSET '
                sql += validColumns.map(c => `${c.name} = '${c.alias || `new_${c.name}`}'`).join(',\n    ')
            } else {
                sql += '\nSET column1 = value1,\n    column2 = value2'
            }
            if (whereConditions.length > 0) {
                sql += '\nWHERE '
                whereConditions.forEach((cond, idx) => {
                    if (idx > 0) sql += ` ${cond.logic} `
                    if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
                        sql += `${cond.column} ${cond.operator}`
                    } else if (cond.operator === 'IN') {
                        sql += `${cond.column} IN (${cond.value})`
                    } else if (cond.operator === 'LIKE') {
                        sql += `${cond.column} LIKE '${cond.value}'`
                    } else {
                        sql += `${cond.column} ${cond.operator} '${cond.value}'`
                    }
                })
            }
            sql += ';'
            return sql
        }

        if (queryType === 'DELETE') {
            let sql = `DELETE FROM ${tableName}`
            if (whereConditions.length > 0) {
                sql += '\nWHERE '
                whereConditions.forEach((cond, idx) => {
                    if (idx > 0) sql += ` ${cond.logic} `
                    if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
                        sql += `${cond.column} ${cond.operator}`
                    } else if (cond.operator === 'IN') {
                        sql += `${cond.column} IN (${cond.value})`
                    } else if (cond.operator === 'LIKE') {
                        sql += `${cond.column} LIKE '${cond.value}'`
                    } else {
                        sql += `${cond.column} ${cond.operator} '${cond.value}'`
                    }
                })
            } else {
                sql += '\n-- WARNING: No WHERE clause! This will delete ALL rows!'
            }
            sql += ';'
            return sql
        }

        return '-- Select a query type to begin'
    }, [queryType, selectedColumns, tableName, tableAlias, distinct, ctes, windowFuncs, joins, whereConditions, groupBy, unionQueries, orderBy, orderDirection, limit])

    const handleDownload = () => {
        const blob = new Blob([generatedSql], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'generated_query.sql'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedSql)
    }

    // All the existing helper functions
    const addColumn = () => setSelectedColumns([...selectedColumns, { id: Date.now().toString(), name: '' }])
    const updateColumn = (id: string, field: 'name' | 'alias', value: string) => setSelectedColumns(selectedColumns.map(c => c.id === id ? { ...c, [field]: value } : c))
    const removeColumn = (id: string) => setSelectedColumns(selectedColumns.filter(c => c.id !== id))

    const addCTE = () => setCtes([...ctes, { id: Date.now().toString(), name: `cte${ctes.length + 1}`, query: 'SELECT * FROM table' }])
    const updateCTE = (id: string, field: 'name' | 'query', value: string) => setCtes(ctes.map(c => c.id === id ? { ...c, [field]: value } : c))
    const removeCTE = (id: string) => setCtes(ctes.filter(c => c.id !== id))

    const addWindowFunc = () => setWindowFuncs([...windowFuncs, { id: Date.now().toString(), function: 'ROW_NUMBER', column: '', alias: 'row_num', partitionBy: '', orderBy: '', orderDirection: 'ASC' }])
    const updateWindowFunc = (id: string, field: keyof WindowFunc, value: any) => setWindowFuncs(windowFuncs.map(w => w.id === id ? { ...w, [field]: value } : w))
    const removeWindowFunc = (id: string) => setWindowFuncs(windowFuncs.filter(w => w.id !== id))

    const addJoin = () => setJoins([...joins, { id: Date.now().toString(), type: 'INNER', table: '', alias: '', onConditions: [] }])
    const updateJoin = (id: string, field: keyof Join, value: any) => setJoins(joins.map(j => j.id === id ? { ...j, [field]: value } : j))
    const removeJoin = (id: string) => setJoins(joins.filter(j => j.id !== id))

    const addJoinCondition = (joinId: string) => {
        setJoins(joins.map(j => {
            if (j.id === joinId) {
                return { ...j, onConditions: [...j.onConditions, { id: Date.now().toString(), leftColumn: '', operator: '=', rightColumn: '', logic: 'AND' }] }
            }
            return j
        }))
    }

    const updateJoinCondition = (joinId: string, condId: string, field: keyof JoinCondition, value: any) => {
        setJoins(joins.map(j => {
            if (j.id === joinId) {
                return { ...j, onConditions: j.onConditions.map(c => c.id === condId ? { ...c, [field]: value } : c) }
            }
            return j
        }))
    }

    const removeJoinCondition = (joinId: string, condId: string) => {
        setJoins(joins.map(j => {
            if (j.id === joinId) {
                return { ...j, onConditions: j.onConditions.filter(c => c.id !== condId) }
            }
            return j
        }))
    }

    const addWhereCondition = () => setWhereConditions([...whereConditions, { id: Date.now().toString(), column: '', operator: '=', value: '', logic: 'AND' }])
    const updateWhereCondition = (id: string, field: keyof WhereCondition, value: any) => setWhereConditions(whereConditions.map(w => w.id === id ? { ...w, [field]: value } : w))
    const removeWhereCondition = (id: string) => setWhereConditions(whereConditions.filter(w => w.id !== id))

    const addGroupByColumn = (column: string) => {
        if (column && !groupBy.columns.includes(column)) {
            setGroupBy({ ...groupBy, columns: [...groupBy.columns, column] })
        }
    }
    const removeGroupByColumn = (column: string) => setGroupBy({ ...groupBy, columns: groupBy.columns.filter(c => c !== column) })

    const addHavingCondition = () => setGroupBy({ ...groupBy, havingConditions: [...groupBy.havingConditions, { id: Date.now().toString(), column: '', operator: '=', value: '', logic: 'AND' }] })
    const updateHavingCondition = (id: string, field: keyof WhereCondition, value: any) => setGroupBy({ ...groupBy, havingConditions: groupBy.havingConditions.map(h => h.id === id ? { ...h, [field]: value } : h) })
    const removeHavingCondition = (id: string) => setGroupBy({ ...groupBy, havingConditions: groupBy.havingConditions.filter(h => h.id !== id) })

    const addUnionQuery = () => setUnionQueries([...unionQueries, { id: Date.now().toString(), type: 'UNION', query: 'SELECT * FROM table2' }])
    const updateUnionQuery = (id: string, field: keyof UnionQuery, value: any) => setUnionQueries(unionQueries.map(u => u.id === id ? { ...u, [field]: value } : u))
    const removeUnionQuery = (id: string) => setUnionQueries(unionQueries.filter(u => u.id !== id))

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Code2 className="h-6 w-6 text-primary" />
                        SQL Code Generator
                    </h1>
                    <select value={dialect} onChange={(e) => setDialect(e.target.value)} className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="postgresql">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="mssql">SQL Server</option>
                        <option value="synapse">SQL DW Synapse</option>
                        <option value="bigquery">BigQuery</option>
                        <option value="snowflake">Snowflake</option>
                    </select>
                    <select value={queryType} onChange={(e) => setQueryType(e.target.value)} className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="SELECT">SELECT</option>
                        <option value="INSERT">INSERT</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(!isFullScreen)} title={isFullScreen ? "Exit Full Screen" : "Full Screen"}>
                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {dialect === 'synapse' && (
                <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                        <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">
                            Need to create Synapse tables?
                        </p>
                        <p className="text-muted-foreground">
                            For CREATE TABLE statements with advanced Synapse features (distribution, indexing, partitioning, CTAS, external tables),
                            check out the <button onClick={() => navigate('/synapse-ddl')} className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 font-medium">Synapse DDL Helper</button>.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
                <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
                    <ResizablePanel defaultSize={40} minSize={30}>
                        <div className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
                            <h3 className="font-semibold text-sm">Query Builder</h3>

                            {/* CTEs - Only for SELECT */}
                            {queryType === 'SELECT' && ctes.length > 0 && (<div className="space-y-2 border-t pt-3">
                                <label className="text-xs font-medium text-muted-foreground">CTEs (WITH Clause)</label>
                                {ctes.map(cte => (<div key={cte.id} className="space-y-1 border rounded p-2 bg-muted/10">
                                    <div className="flex gap-2 items-center">
                                        <input className="flex h-7 w-32 rounded-md border border-input bg-background px-2 text-sm" value={cte.name} onChange={(e) => updateCTE(cte.id, 'name', e.target.value)} placeholder="cte_name" />
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCTE(cte.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <textarea className="w-full h-16 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono" value={cte.query} onChange={(e) => updateCTE(cte.id, 'query', e.target.value)} placeholder="SELECT..." />
                                </div>))}
                            </div>)}

                            {queryType === 'SELECT' && (<div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={addCTE} className="flex-1">
                                    <Plus className="h-3 w-3 mr-1" />Add CTE
                                </Button>
                                {windowFuncs.length === 0 && (<Button size="sm" variant="outline" onClick={addWindowFunc} className="flex-1">
                                    <Plus className="h-3 w-3 mr-1" />Add Window Func
                                </Button>)}
                            </div>)}

                            {/* Window Functions */}
                            {queryType === 'SELECT' && windowFuncs.length > 0 && (<div className="space-y-2 border-t pt-3">
                                <label className="text-xs font-medium text-muted-foreground">Window Functions</label>
                                {windowFuncs.map(wf => (<div key={wf.id} className="space-y-1 border rounded p-2 bg-muted/10">
                                    <div className="flex gap-1">
                                        <select className="h-7 flex-1 rounded-md border border-input bg-background px-1 text-xs" value={wf.function} onChange={(e) => updateWindowFunc(wf.id, 'function', e.target.value)}>
                                            {WINDOW_FUNCS.map(f => (<option key={f} value={f}>{f}</option>))}
                                        </select>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeWindowFunc(wf.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <input className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" value={wf.column} onChange={(e) => updateWindowFunc(wf.id, 'column', e.target.value)} placeholder="column (for SUM/AVG/etc)" />
                                    <input className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" value={wf.alias} onChange={(e) => updateWindowFunc(wf.id, 'alias', e.target.value)} placeholder="alias" />
                                    <input className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs" value={wf.partitionBy} onChange={(e) => updateWindowFunc(wf.id, 'partitionBy', e.target.value)} placeholder="PARTITION BY (optional)" />
                                    <div className="flex gap-1">
                                        <input className="flex h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs" value={wf.orderBy} onChange={(e) => updateWindowFunc(wf.id, 'orderBy', e.target.value)} placeholder="ORDER BY" />
                                        <select className="h-7 w-16 rounded-md border border-input bg-background px-1 text-xs" value={wf.orderDirection} onChange={(e) => updateWindowFunc(wf.id, 'orderDirection', e.target.value as 'ASC' | 'DESC')}>
                                            <option value="ASC">ASC</option>
                                            <option value="DESC">DESC</option>
                                        </select>
                                    </div>
                                </div>))}
                                <Button size="sm" variant="outline" onClick={addWindowFunc} className="w-full">
                                    <Plus className="h-3 w-3 mr-1" />Add Window Function
                                </Button>
                            </div>)}

                            {/* Rest of the existing UI... */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Table Name</label>
                                <div className="flex gap-2">
                                    <input className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="table_name" />
                                    <input className="flex h-9 w-20 rounded-md border border-input bg-background px-2 text-sm" value={tableAlias} onChange={(e) => setTableAlias(e.target.value)} placeholder="alias" />
                                </div>
                            </div>

                            {queryType === 'SELECT' && (<div className="flex items-center gap-2">
                                <input type="checkbox" id="distinct" checked={distinct} onChange={(e) => setDistinct(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                                <label htmlFor="distinct" className="text-xs font-medium text-muted-foreground cursor-pointer">DISTINCT</label>
                            </div>)}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        {queryType === 'INSERT' ? 'Columns & Values' :
                                            queryType === 'UPDATE' ? 'SET Columns & Values' :
                                                queryType === 'DELETE' ? 'Columns (for reference)' :
                                                    'Columns'}
                                    </label>
                                    {queryType !== 'DELETE' && (<Button size="sm" variant="outline" onClick={addColumn}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add
                                    </Button>)}
                                </div>
                                {queryType !== 'DELETE' && (<div className="space-y-2">
                                    {selectedColumns.map((col) => (<div key={col.id} className="flex gap-2 items-center">
                                        <input className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={col.name} onChange={(e) => updateColumn(col.id, 'name', e.target.value)} placeholder="column_name" />
                                        <input className="flex h-8 w-24 rounded-md border border-input bg-background px-2 text-sm" value={col.alias || ''} onChange={(e) => updateColumn(col.id, 'alias', e.target.value)} placeholder={queryType === 'INSERT' || queryType === 'UPDATE' ? "value" : "alias"} />
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeColumn(col.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>))}
                                </div>)}
                            </div>

                            {/* JOINs (existing code) */}
                            {queryType === 'SELECT' && joins.length > 0 && (<div className="space-y-2 border-t pt-3">
                                <label className="text-xs font-medium text-muted-foreground">JOINs</label>
                                {joins.map((join) => (<div key={join.id} className="space-y-2 border rounded p-2 bg-muted/20">
                                    <div className="flex gap-2 items-start">
                                        <select className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm" value={join.type} onChange={(e) => updateJoin(join.id, 'type', e.target.value)}>
                                            {JOIN_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                                        </select>
                                        <input className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={join.table} onChange={(e) => updateJoin(join.id, 'table', e.target.value)} placeholder="table_name" />
                                        <input className="flex h-8 w-16 rounded-md border border-input bg-background px-2 text-sm" value={join.alias || ''} onChange={(e) => updateJoin(join.id, 'alias', e.target.value)} placeholder="alias" />
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeJoin(join.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="space-y-1 pl-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">ON Conditions</span>
                                            <Button size="sm" variant="ghost" onClick={() => addJoinCondition(join.id)} className="h-6 text-xs">
                                                <Plus className="h-3 w-3 mr-1" />Add
                                            </Button>
                                        </div>
                                        {join.onConditions.map((cond, condIdx) => (<div key={cond.id} className="space-y-1">
                                            {condIdx > 0 && (<select className="h-6 w-16 rounded-md border border-input bg-background px-1 text-xs" value={cond.logic} onChange={(e) => updateJoinCondition(join.id, cond.id, 'logic', e.target.value)}>
                                                <option value="AND">AND</option>
                                                <option value="OR">OR</option>
                                            </select>)}
                                            <div className="flex gap-1 items-center">
                                                <input className="flex h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs" value={cond.leftColumn} onChange={(e) => updateJoinCondition(join.id, cond.id, 'leftColumn', e.target.value)} placeholder="left.col" />
                                                <select className="h-7 w-12 rounded-md border border-input bg-background px-1 text-xs" value={cond.operator} onChange={(e) => updateJoinCondition(join.id, cond.id, 'operator', e.target.value)}>
                                                    <option value="=">=</option>
                                                    <option value="!=">!=</option>
                                                </select>
                                                <input className="flex h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs" value={cond.rightColumn} onChange={(e) => updateJoinCondition(join.id, cond.id, 'rightColumn', e.target.value)} placeholder="right.col" />
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeJoinCondition(join.id, cond.id)}>
                                                    <Trash2 className="h-2.5 w-2.5" />
                                                </Button>
                                            </div>
                                        </div>))}
                                    </div>
                                </div>))}
                            </div>)}
                            {queryType === 'SELECT' && (<div className="flex"><Button size="sm" variant="outline" onClick={addJoin} className="w-full">
                                <Plus className="h-3 w-3 mr-1" />Add JOIN
                            </Button></div>)}

                            {/* WHERE, GROUP BY, ORDER BY, LIMIT (keep existing code as-is) */}
                            <div className="space-y-2 border-t pt-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-muted-foreground">WHERE Conditions</label>
                                    <Button size="sm" variant="outline" onClick={addWhereCondition}>
                                        <Plus className="h-3 w-3 mr-1" />Add
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {whereConditions.map((cond, idx) => (<div key={cond.id} className="space-y-1">
                                        {idx > 0 && (<select className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs" value={cond.logic} onChange={(e) => updateWhereCondition(cond.id, 'logic', e.target.value)}>
                                            <option value="AND">AND</option>
                                            <option value="OR">OR</option>
                                        </select>)}
                                        <div className="flex gap-2 items-center">
                                            <input className="flex h-8 w-28 rounded-md border border-input bg-background px-2 text-sm" value={cond.column} onChange={(e) => updateWhereCondition(cond.id, 'column', e.target.value)} placeholder="column" />
                                            <select className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm" value={cond.operator} onChange={(e) => updateWhereCondition(cond.id, 'operator', e.target.value)}>
                                                {OPERATORS.map(op => (<option key={op} value={op}>{op}</option>))}
                                            </select>
                                            <input className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={cond.value} onChange={(e) => updateWhereCondition(cond.id, 'value', e.target.value)} placeholder="value" disabled={cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL'} />
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeWhereCondition(cond.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>))}
                                </div>
                            </div>

                            {queryType === 'SELECT' && (<div className="space-y-2 border-t pt-3">
                                <label className="text-xs font-medium text-muted-foreground">GROUP BY</label>
                                <div className="flex gap-2">
                                    <input id="groupby-input" className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="column_name (Enter or click Add)" onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const input = e.target as HTMLInputElement
                                            if (input.value.trim()) {
                                                addGroupByColumn(input.value.trim())
                                                input.value = ''
                                            }
                                        }
                                    }} />
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const input = document.getElementById('groupby-input') as HTMLInputElement
                                        if (input?.value.trim()) {
                                            addGroupByColumn(input.value.trim())
                                            input.value = ''
                                        }
                                    }}>
                                        <Plus className="h-3 w-3 mr-1" />Add
                                    </Button>
                                </div>
                                {groupBy.columns.length > 0 && (<div className="flex flex-wrap gap-1">
                                    {groupBy.columns.map(col => (<div key={col} className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded text-xs">
                                        <span>{col}</span>
                                        <button onClick={() => removeGroupByColumn(col)} className="hover:text-destructive">×</button>
                                    </div>))}
                                </div>)}
                                {groupBy.columns.length > 0 && (<div className="space-y-2 mt-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-muted-foreground">HAVING</label>
                                        <Button size="sm" variant="outline" onClick={addHavingCondition}>
                                            <Plus className="h-3 w-3 mr-1" />Add
                                        </Button>
                                    </div>
                                    {groupBy.havingConditions.map((cond, idx) => (<div key={cond.id} className="space-y-1">
                                        {idx > 0 && (<select className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs" value={cond.logic} onChange={(e) => updateHavingCondition(cond.id, 'logic', e.target.value)}>
                                            <option value="AND">AND</option>
                                            <option value="OR">OR</option>
                                        </select>)}
                                        <div className="flex gap-2 items-center">
                                            <input className="flex h-8 w-28 rounded-md border border-input bg-background px-2 text-sm" value={cond.column} onChange={(e) => updateHavingCondition(cond.id, 'column', e.target.value)} placeholder="aggregate" />
                                            <select className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm" value={cond.operator} onChange={(e) => updateHavingCondition(cond.id, 'operator', e.target.value)}>
                                                {OPERATORS.map(op => (<option key={op} value={op}>{op}</option>))}
                                            </select>
                                            <input className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={cond.value} onChange={(e) => updateHavingCondition(cond.id, 'value', e.target.value)} placeholder="value" />
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeHavingCondition(cond.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>))}
                                </div>)}
                            </div>)}

                            {queryType === 'SELECT' && (<div className="space-y-2 border-t pt-3">
                                <label className="text-xs font-medium text-muted-foreground">ORDER BY</label>
                                <div className="flex gap-2">
                                    <input className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={orderBy} onChange={(e) => setOrderBy(e.target.value)} placeholder="column_name" />
                                    <select className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm" value={orderDirection} onChange={(e) => setOrderDirection(e.target.value as 'ASC' | 'DESC')}>
                                        <option value="ASC">ASC</option>
                                        <option value="DESC">DESC</option>
                                    </select>
                                </div>
                            </div>)}

                            {/* UNION Queries - Only for SELECT */}
                            {queryType === 'SELECT' && unionQueries.length > 0 && (<div className="space-y-2 border-t pt-3">
                                <label className="text-xs font-medium text-muted-foreground">UNION Queries</label>
                                {unionQueries.map(uq => (<div key={uq.id} className="space-y-1 border rounded p-2 bg-muted/10">
                                    <div className="flex gap-2 items-center">
                                        <select className="h-7 w-28 rounded-md border border-input bg-background px-2 text-sm" value={uq.type} onChange={(e) => updateUnionQuery(uq.id, 'type', e.target.value)}>
                                            <option value="UNION">UNION</option>
                                            <option value="UNION ALL">UNION ALL</option>
                                        </select>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeUnionQuery(uq.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <textarea className="w-full h-16 rounded-md border border-input bg-background px-2 py-1 text-xs font-mono" value={uq.query} onChange={(e) => updateUnionQuery(uq.id, 'query', e.target.value)} placeholder="SELECT * FROM table2" />
                                </div>))}
                            </div>)}

                            {queryType === 'SELECT' && (<div className="flex">
                                <Button size="sm" variant="outline" onClick={addUnionQuery} className="w-full">
                                    <Plus className="h-3 w-3 mr-1" />Add UNION
                                </Button>
                            </div>)}

                            {queryType === 'SELECT' && (<div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">LIMIT</label>
                                <input type="number" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="10" />
                            </div>)}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={60} minSize={30}>
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                                <span className="text-xs font-medium text-muted-foreground uppercase">Generated SQL</span>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopy} title="Copy SQL">
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDownload} title="Download SQL">
                                        <Download className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <CodeEditor value={generatedSql} language="sql" readOnly={true} hideHeader={true} />
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
