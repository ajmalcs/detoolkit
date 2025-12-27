import { useState } from 'react'
import { format } from 'sql-formatter'
import { Parser } from 'node-sql-parser'
import { Copy, RotateCcw, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'
import { CodeEditor } from '../components/ui/code-editor'

const languages = [
    { value: 'sql', label: 'Standard SQL' },
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'tsql', label: 'Transact-SQL (SQL Server)' },
    { value: 'plsql', label: 'PL/SQL' },
    { value: 'bigquery', label: 'BigQuery' },
    { value: 'synapse', label: 'SQL DW Synapse' },
]

export default function SqlFormatter() {
    const [input, setInput] = useState('')
    const [dialect, setDialect] = useState('tsql')
    const [output, setOutput] = useState('')
    const [error, setError] = useState('')
    const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | null>(null)
    const [ignoreErrors, setIgnoreErrors] = useState(false)
    const [loading, setLoading] = useState(false)

    const parser = new Parser()

    const validateSql = (sql: string, dialect: string) => {
        try {
            // Map our dialects to node-sql-parser dialects
            let parserDialect = 'mysql'; // Default
            if (dialect === 'postgresql') parserDialect = 'postgresql';
            if (dialect === 'bigquery') parserDialect = 'bigquery';
            if (dialect === 'tsql' || dialect === 'synapse') parserDialect = 'transactsql';

            // node-sql-parser doesn't support all dialects perfectly, so we use it as a heuristic.
            // If it throws, we check the error.
            const ast = parser.astify(sql, { database: parserDialect as any });

            // Extra semantic checks (node-sql-parser is sometimes too lenient)
            if (ast) {
                const statements = Array.isArray(ast) ? ast : [ast];
                for (const stmt of statements) {
                    if (stmt.type === 'select') {
                        // Check: SELECT ... WHERE ... without FROM
                        if (!stmt.from && stmt.where) {
                            return "Missing FROM clause. A SELECT statement with a WHERE clause must specify a table.";
                        }
                        // Check: SELECT col1, col2 ... without FROM (heuristic: if simple columns are selected)
                        if (!stmt.from && stmt.columns) {
                            const hasColumnRef = stmt.columns.some((c: any) => c.expr && c.expr.type === 'column_ref');
                            if (hasColumnRef) {
                                return "Missing FROM clause. You are selecting columns but not specifying a table.";
                            }
                        }
                    }
                }
            }

            return true;
        } catch (e: any) {
            // simplify error message
            let msg = e.message || 'Unknown syntax error';

            // Common parser error "Expected ..., output ..." is very long.
            if (msg.includes('Expected') && msg.includes('found')) {
                // Try to extract what was found
                const foundMatch = msg.match(/found\s+"([^"]+)"/);
                const found = foundMatch ? foundMatch[1] : 'end of input';

                if (found === 'end of input' || msg.includes('end of input found')) {
                    return "Unexpected end of input. Complete your statement.";
                }
                return `Unexpected token: "${found}". Check for typos or invalid syntax.`;
            }

            return msg;
        }
    }

    const handleFormat = () => {
        if (!input.trim()) return

        setLoading(true)
        setValidationStatus(null)
        setError('')

        setTimeout(() => {
            // 1. Validate first
            const validationResult = validateSql(input, dialect);

            if (validationResult !== true) {
                // It's an error string
                setValidationStatus('invalid')
                if (!ignoreErrors) {
                    setError(validationResult as string)
                } else {
                    // Clear error if we are ignoring them, to show output
                    setError('')
                }
                // We Still attempt to format, but show the warning
            } else {
                setValidationStatus('valid')
            }

            try {
                const formatted = format(input, {
                    language: dialect as any,
                    keywordCase: 'upper',
                })
                setOutput(formatted)
            } catch (e) {
                setError('Formatter Error: ' + (e as Error).message)
                setOutput('')
            } finally {
                setLoading(false)
            }
        }, 10)
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(output)
    }

    const handleClear = () => {
        setInput('')
        setOutput('')
        setError('')
        setValidationStatus(null)
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">SQL Formatter</h1>
                    <select
                        value={dialect}
                        onChange={(e) => setDialect(e.target.value)}
                        className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        {languages.map((l) => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={ignoreErrors ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setIgnoreErrors(!ignoreErrors)}
                        className={ignoreErrors ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20" : "text-muted-foreground"}
                        title={ignoreErrors ? "Errors are ignored" : "Click to ignore validation errors"}
                    >
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        {ignoreErrors ? "Ignoring Errors" : "Ignore Errors"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClear}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                    <Button onClick={handleFormat} disabled={loading}>
                        {loading ? 'Formatting...' : 'Format SQL'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="horizontal" className="flex-1 h-full min-h-0 rounded-lg border">
                    <ResizablePanel defaultSize={50} minSize={20}>
                        <Card className="flex flex-col h-full rounded-none border-0 relative">
                            <div className="absolute top-2 right-4 z-10 flex gap-2">
                                {validationStatus === 'valid' && (
                                    <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded border border-green-500/20">
                                        <CheckCircle2 className="h-3 w-3" /> Valid SQL
                                    </span>
                                )}
                                {validationStatus === 'invalid' && (
                                    <span className="flex items-center gap-1 text-xs bg-red-500/10 text-red-600 px-2 py-1 rounded border border-red-500/20">
                                        <AlertTriangle className="h-3 w-3" /> Invalid Syntax
                                    </span>
                                )}
                                <label className="text-sm font-medium text-muted-foreground bg-background/80 px-2 rounded">Raw SQL</label>
                            </div>
                            <div className="flex-1 w-full relative min-h-0">
                                <CodeEditor
                                    value={input}
                                    onChange={(val) => setInput(val || '')}
                                    language="sql"
                                />
                            </div>
                        </Card>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={50} minSize={20}>
                        <Card className="flex flex-col h-full bg-card overflow-hidden relative rounded-none border-0">
                            <label className="text-sm font-medium text-muted-foreground absolute top-2 right-16 z-10 bg-background/80 px-2 rounded">Formatted</label>
                            {error ? (
                                <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 m-4 flex flex-col items-start gap-4">
                                    <div className="flex items-center gap-2 font-medium">
                                        <AlertTriangle className="h-5 w-5" />
                                        Validation Error
                                    </div>
                                    <p className="text-sm border-l-2 border-destructive/30 pl-3">
                                        {error}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-hidden relative">
                                    {output && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="absolute top-2 right-2 z-20 text-muted-foreground hover:text-foreground"
                                            onClick={handleCopy}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <CodeEditor
                                        value={output}
                                        language="sql"
                                        readOnly={true}
                                    />
                                </div>
                            )}
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
