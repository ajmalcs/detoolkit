import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { CodeEditor } from '../components/ui/code-editor'
import { ArrowRight, Download, RefreshCw, Wand2, Minimize2, Maximize2 } from 'lucide-react'
import { faker } from '@faker-js/faker'
import { Parser } from 'node-sql-parser'




export default function MockDataGenerator() {
    const [inputSql, setInputSql] = useState('CREATE TABLE users (\n    id INT,\n    first_name VARCHAR(50),\n    last_name VARCHAR(50),\n    email VARCHAR(100),\n    created_at TIMESTAMP,\n    is_active BOOLEAN\n);')
    const [outputData, setOutputData] = useState('')
    const [rowCount, setRowCount] = useState(50)
    const [format, setFormat] = useState('sql')
    const [dialect, setDialect] = useState('tsql')
    const [viewMode, setViewMode] = useState<'code' | 'table'>('code')
    const [previewRows, setPreviewRows] = useState<any[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const parseColumns = (sql: string) => {
        try {
            // Pre-process Synapse-specific syntax before parsing
            let cleanSql = sql.trim()

            // Remove Synapse-specific clauses that prevent parsing
            // Strip WITH (DISTRIBUTION = ..., HEAP/CLUSTERED COLUMNSTORE INDEX, etc.)
            cleanSql = cleanSql.replace(/WITH\s*\([^)]*DISTRIBUTION[^)]*\)/gi, '')
            cleanSql = cleanSql.replace(/WITH\s*\([^)]*PARTITION[^)]*\)/gi, '')
            cleanSql = cleanSql.replace(/CLUSTERED\s+COLUMNSTORE\s+INDEX/gi, '')
            cleanSql = cleanSql.replace(/HEAP/gi, '')

            // Clean up extra whitespace
            cleanSql = cleanSql.replace(/\s+/g, ' ').trim()

            if (!cleanSql.endsWith(';')) cleanSql += ';'

            const parser = new Parser()
            const ast = parser.astify(cleanSql) as any

            if (!ast || !ast.create_definitions) {
                throw new Error("Could not parse table definition")
            }

            const tableName = ast.table[0].table
            const cols = ast.create_definitions.map((def: any) => ({
                name: def.column.column,
                type: def.definition.dataType
            }))

            return { tableName, cols }
        } catch (e: any) {
            // Fallback: Regex for Synapse/SSMS-friendly CREATE TABLE
            // Match with square brackets and schema prefixes like [dbo].[TableName]
            // Also handle Synapse WITH clauses

            // First, strip out Synapse-specific clauses
            let cleanSql = sql
                .replace(/WITH\s*\([^)]*DISTRIBUTION[^)]*\)/gi, '')
                .replace(/WITH\s*\([^)]*PARTITION[^)]*\)/gi, '')
                .replace(/CLUSTERED\s+COLUMNSTORE\s+INDEX/gi, '')
                .replace(/HEAP/gi, '')
                .trim()

            // Match CREATE TABLE with optional schema and brackets
            // Pattern: CREATE TABLE [schema].[table] OR CREATE TABLE table OR CREATE TABLE [table]
            const tableMatch = cleanSql.match(/CREATE\s+TABLE\s+(?:\[?\w+\]?\.)?\[?(\w+)\]?\s*\(([\s\S]*?)\)(?:\s*;)?$/i)

            if (tableMatch) {
                const tableName = tableMatch[1]
                const colBlock = tableMatch[2]

                // VALIDATION: Check for missing commas & data types line-by-line
                const lines = colBlock.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('--'))
                const simpleColRegex = /^\s*[a-zA-Z0-9_"`\[\]]+\s+(INT|VARCHAR|TEXT|BOOLEAN|DATE|TIMESTAMP|DATETIME|DATETIME2|FLOAT|DECIMAL|DOUBLE|REAL|CHAR|BINARY|VARBINARY|BLOB|JSON|BIT|NVARCHAR|NCHAR|NUMBER|STRING|BOOL|BIGINT|SMALLINT|TINYINT|MONEY|UNIQUEIDENTIFIER)/i

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim()
                    // Don't check next line if last
                    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''

                    if (simpleColRegex.test(line)) {
                        // If current line defines a column...
                        if (!line.endsWith(',') && i < lines.length - 1) {
                            // And next line also defines a column...
                            if (simpleColRegex.test(nextLine)) {
                                // Missing comma detected!
                                throw new Error(`Syntax Error: Missing comma after "${line}"`)
                            }
                        }
                    } else if (/^\s*[a-zA-Z0-9_"`\[\]]+\s*(,)?\s*$/.test(line)) {
                        // Check 2: Missing Data Type
                        const firstWord = line.split(/\s+/)[0].toUpperCase().replace(/,/g, '').replace(/\[|\]/g, '')
                        const ignoredKeywords = ['PRIMARY', 'CONSTRAINT', 'UNIQUE', 'FOREIGN', 'CHECK', 'INDEX', ')', ');']
                        if (!ignoredKeywords.includes(firstWord) && !line.startsWith(')')) {
                            throw new Error(`Syntax Error: Missing data type for column "${line.replace(/,/g, '')}"`)
                        }
                    }
                }

                // If validation passed, extract columns
                // We can't use split(',') because it usually swallows the lines missed.
                // Instead we match ALL column-like patterns
                const cols: { name: string, type: string }[] = []
                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/)
                    if (parts.length >= 2) {
                        // Remove trailing comma from type if present
                        let type = parts[1]
                        if (type.endsWith(',')) type = type.slice(0, -1)

                        // Clean name - remove square brackets, backticks, quotes
                        let name = parts[0].replace(/[`"\[\]]/g, '')

                        // Basic validation that looks like a name/type
                        if (name && /^[a-zA-Z]/.test(type)) { // Type usually starts with letter
                            cols.push({ name, type })
                        }
                    }
                })

                if (cols.length > 0) {
                    return { tableName, cols }
                }
            }

            // If regex also verified nothing useful, throw strict error
            throw new Error(e.message || "Invalid CREATE TABLE statement. For Synapse DDL, make sure the column definitions are inside parentheses.")
        }
    }

    const generateRow = (cols: { name: string, type: string }[]) => {
        const row: any = {}
        cols.forEach(col => {
            const name = col.name.toLowerCase()
            const type = col.type.toLowerCase()

            if (name === 'id' || name.endsWith('_id')) {
                row[col.name] = faker.number.int({ min: 1, max: 10000 })
            } else if (name.includes('email')) {
                row[col.name] = faker.internet.email()
            } else if (name.includes('name')) {
                if (name.includes('first')) row[col.name] = faker.person.firstName()
                else if (name.includes('last')) row[col.name] = faker.person.lastName()
                else row[col.name] = faker.person.fullName()
            } else if (name.includes('date') || name.includes('time') || name.includes('_at')) {
                row[col.name] = faker.date.past().toISOString()
            } else if (name.startsWith('is_') || type === 'boolean') {
                row[col.name] = faker.datatype.boolean()
            } else if (type.includes('int')) {
                row[col.name] = faker.number.int({ min: 0, max: 100 })
            } else {
                row[col.name] = faker.word.noun()
            }
        })
        return row
    }

    const handleGenerate = () => {
        setError(null)
        setIsGenerating(true)

        // Small delay to allow UI to update
        setTimeout(() => {
            try {
                const { tableName, cols } = parseColumns(inputSql)
                const rows = Array.from({ length: rowCount }).map(() => generateRow(cols as { name: string, type: string }[]))
                setPreviewRows(rows)

                if (format === 'json') {
                    setOutputData(JSON.stringify(rows, null, 2))
                } else if (format === 'csv') {
                    const header = (cols as any[]).map(c => c.name).join(',')
                    const lines = rows.map(r => (cols as any[]).map(c => r[c.name]).join(','))
                    setOutputData([header, ...lines].join('\n'))
                } else {
                    // SQL
                    const statements = rows.map(r => {
                        const values = (cols as any[]).map(c => {
                            const val = r[c.name]

                            if (typeof val === 'string') {
                                // Basic escaping: replace single quotes with two single quotes
                                return `'${val.replace(/'/g, "''")}'`
                            }
                            if (typeof val === 'boolean') {
                                if (dialect === 'mysql' || dialect === 'mssql' || dialect === 'synapse') return val ? 1 : 0
                                return val ? 'TRUE' : 'FALSE' // Standard/Postgres/BigQuery
                            }
                            if (val instanceof Date) {
                                // Standard/Postgres/MySQL/BigQuery usually ok with 'YYYY-MM-DD HH:mm:ss'
                                return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`
                            }
                            return val
                        }).join(', ')

                        let qL = '', qR = ''
                        if (dialect === 'mysql' || dialect === 'bigquery') { qL = '`'; qR = '`' }
                        else if (dialect === 'mssql' || dialect === 'synapse') { qL = '['; qR = ']' }
                        else if (dialect === 'postgres') { qL = '"'; qR = '"' }
                        // Standard: usually double quotes for identifiers, but let's stick to none if standard to be safe unless needed.

                        const colList = (cols as any[]).map(c => `${qL}${c.name}${qR}`).join(', ')
                        return `INSERT INTO ${qL}${tableName}${qR} (${colList}) VALUES (${values});`
                    })
                    setOutputData(statements.join('\n'))
                }
            } catch (e: any) {
                setError(e.message)
            } finally {
                setIsGenerating(false)
            }
        }, 100)
    }

    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        if (!outputData) return
        const extension = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'sql'
        const type = format === 'json' ? 'application/json' : 'text/plain'

        const blob = new Blob([outputData], { type })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `mock_data.${extension}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Wand2 className="h-6 w-6 text-primary" />
                    Smart Mock Data Generator
                </h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 border px-3 py-1 rounded-md bg-background">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Row Count:</span>
                        <input
                            type="number"
                            min="1"
                            max="1000"
                            value={rowCount}
                            onChange={e => setRowCount(parseInt(e.target.value))}
                            className="w-16 h-8 text-sm outline-none bg-transparent"
                        />
                    </div>
                    <select
                        value={format}
                        onChange={e => setFormat(e.target.value)}
                        className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                    >
                        <option value="sql">SQL Insert Statements</option>
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                    </select>

                    {format === 'sql' && (
                        <select
                            value={dialect}
                            onChange={e => setDialect(e.target.value)}
                            className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="standard">Standard SQL</option>
                            <option value="bigquery">BigQuery</option>
                            <option value="mysql">MySQL</option>
                            <option value="mssql">T-SQL (MSSQL)</option>
                            <option value="synapse">Synapse (Dedicated Pool)</option>
                            <option value="postgres">PostgreSQL</option>
                        </select>
                    )}
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                        Generate
                    </Button>
                    <div className="w-px h-6 bg-border mx-2" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                    >
                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
                {/* Input Panel */}
                <div className="flex-1 flex flex-col gap-2 relative">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-muted-foreground">Files Schema (CREATE TABLE)</div>
                    </div>
                    <Textarea
                        className={`flex-1 font-mono text-sm resize-none ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        value={inputSql}
                        onChange={e => setInputSql(e.target.value)}
                        placeholder="Paste your CREATE TABLE statement here..."
                    />
                    {error && (
                        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                            <span className="font-bold">Syntax Error:</span> {error}
                        </div>
                    )}
                </div>

                {/* Output Panel */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-muted-foreground mr-2">Generated Data</div>
                            <div className="flex border rounded-md overflow-hidden bg-background">
                                <button
                                    onClick={() => setViewMode('code')}
                                    className={`px-3 py-1 text-xs ${viewMode === 'code' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}
                                >
                                    Code
                                </button>
                                <div className="w-px bg-border" />
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-1 text-xs ${viewMode === 'table' ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}
                                >
                                    Table
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDownload}
                                disabled={!outputData}
                                title={`Download as .${format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'sql'}`}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    let textToCopy = outputData

                                    if (viewMode === 'table' && previewRows.length > 0) {
                                        // Generate TSV for spreadsheet copy
                                        const headers = Object.keys(previewRows[0]).join('\t')
                                        const rows = previewRows.map(r => Object.values(r).map(v =>
                                            typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v)
                                        ).join('\t')).join('\n')
                                        textToCopy = `${headers}\n${rows}`
                                    }

                                    if (!textToCopy) return
                                    navigator.clipboard.writeText(textToCopy).then(() => {
                                        const btn = document.getElementById('copy-btn-text')
                                        if (btn) btn.innerText = 'Copied!'
                                        setTimeout(() => {
                                            if (btn) btn.innerText = 'Copy'
                                        }, 2000)
                                    }).catch(() => {
                                        // Fallback for some environments
                                        const textArea = document.createElement("textarea")
                                        textArea.value = textToCopy
                                        document.body.appendChild(textArea)
                                        textArea.select()
                                        document.execCommand("copy")
                                        document.body.removeChild(textArea)

                                        const btn = document.getElementById('copy-btn-text')
                                        if (btn) btn.innerText = 'Copied!'
                                        setTimeout(() => {
                                            if (btn) btn.innerText = 'Copy'
                                        }, 2000)
                                    })
                                }}
                            >
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 border rounded-md overflow-hidden bg-background relative">
                        {viewMode === 'code' ? (
                            <CodeEditor
                                value={outputData}
                                language={format === 'sql' ? 'sql' : format === 'json' ? 'json' : 'text'}
                                readOnly
                            />
                        ) : (
                            <div className="absolute inset-0 overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
                                        <tr>
                                            {previewRows.length > 0 && Object.keys(previewRows[0]).map(key => (
                                                <th key={key} className="px-4 py-3 font-medium">{key}</th>
                                            ))}
                                            {previewRows.length === 0 && <th className="px-4 py-3">No data</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row, i) => (
                                            <tr key={i} className="border-b hover:bg-muted/50">
                                                {Object.values(row).map((val: any, j) => (
                                                    <td key={j} className="px-4 py-2 whitespace-nowrap">
                                                        {typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

