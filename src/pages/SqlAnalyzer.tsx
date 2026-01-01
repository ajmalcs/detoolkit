import { useState, useCallback, useEffect } from 'react'
import { Parser } from 'node-sql-parser'
import { AlertTriangle, Info, AlertCircle, Play, ShieldCheck, Minimize2, Maximize2, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'
import { CodeEditor } from '../components/ui/code-editor'

interface AnalysisResult {
    id: string
    type: 'critical' | 'warning' | 'info'
    message: string
    recommendation: string
    line?: number
}

const parser = new Parser()

export default function SqlAnalyzer() {
    const [input, setInput] = useState('SELECT * FROM users WHERE email LIKE \'%@gmail.com\' OR status = \'inactive\'')
    const [dialect, setDialect] = useState('transactsql')
    const [results, setResults] = useState<AnalysisResult[]>([])
    const [analyzing, setAnalyzing] = useState(false)

    // Map our dialects to node-sql-parser supported dialects
    const getParserDialect = (d: string): string => {
        const dialectMap: Record<string, string> = {
            'transactsql': 'transactsql',
            'tsql': 'transactsql',
            'postgresql': 'postgresql',
            'mysql': 'mysql',
            'bigquery': 'bigquery',
            'sql': 'mysql' // Default fallback
        }
        return dialectMap[d] || 'mysql'
    }

    const analyze = useCallback(() => {
        setAnalyzing(true)
        const findings: AnalysisResult[] = []

        try {
            // 1. Basic AST generation with validated dialect
            const ast = parser.astify(input, { database: getParserDialect(dialect) as any })
            const statements = Array.isArray(ast) ? ast : [ast]

            statements.forEach((stmt: any) => {
                if (stmt.type === 'select') {
                    // CHECK 1: SELECT *
                    const hasStar = stmt.columns === '*' || (Array.isArray(stmt.columns) && stmt.columns.some((c: any) => c.expr && c.expr.type === 'column_ref' && c.expr.column === '*'));
                    if (hasStar) {
                        findings.push({
                            id: 'select-star',
                            type: 'warning',
                            message: 'Avoid "SELECT *"',
                            recommendation: 'Explicitly list columns to reduce I/O cost and network bandwidth.'
                        })
                    }

                    // CHECK 2: OR in WHERE
                    if (stmt.where) {
                        const checkWhere = (expr: any) => {
                            if (!expr) return;
                            if (expr.operator === 'OR') {
                                findings.push({
                                    id: 'or-condition',
                                    type: 'info',
                                    message: 'OR condition detected in WHERE clause',
                                    recommendation: 'Check if index usage is hindered. In some DBs, UNION ALL might be faster.'
                                })
                            }
                            if (expr.left) checkWhere(expr.left)
                            if (expr.right) checkWhere(expr.right)
                        }
                        checkWhere(stmt.where)

                        // CHECK 3: LEADING WILDCARD
                        const checkLike = (expr: any) => {
                            if (!expr) return;
                            if (expr.operator === 'LIKE' || expr.operator === 'ILIKE') {
                                if (expr.right && expr.right.type === 'single_quote_string' && expr.right.value.startsWith('%')) {
                                    findings.push({
                                        id: 'leading-wildcard',
                                        type: 'critical',
                                        message: 'Leading Wildcard in LIKE clause',
                                        recommendation: 'Like \'%value\' prevents index usage. Consider Full-Text Search.'
                                    })
                                }
                            }
                            if (expr.left) checkLike(expr.left)
                            if (expr.right) checkLike(expr.right)
                        }
                        checkLike(stmt.where)
                    }
                }
            })

            // Advanced: Very basic unused CTE check
            // This is complex to do perfectly with just this parser, 
            // but we can check if a WITH clause exists and if its alias is referenced in the main FROM.
            if ((ast as any).with) {
                // (ast as any).with is array of CTEs
                // Check if they are used in the main query FROM
                // const ctes = (ast as any).with;
                // Simplified: Just notifying about CTE usage for now as unused detection is tricky without full traversal
            }

        } catch (e: any) {
            findings.push({
                id: 'syntax-error',
                type: 'critical',
                message: 'Syntax Error',
                recommendation: e.message || 'Fix SQL syntax to enable analysis.'
            })
        }

        setResults(findings)
        setAnalyzing(false)
    }, [input, dialect])

    const handleClear = () => {
        setInput('')
        setResults([])
    }

    // Auto-analyze on mount
    useEffect(() => {
        analyze()
    }, [])

    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        if (!results.length) return
        const report = results.map(r => `[${r.type.toUpperCase()}] ${r.message}\nRecommendation: ${r.recommendation}`).join('\n\n')
        const blob = new Blob([report], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'sql_analysis_report.txt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">SQL Performance Analyzer</h1>
                    <select
                        value={dialect}
                        onChange={(e) => setDialect(e.target.value)}
                        className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <option value="mysql">MySQL</option>
                        <option value="postgresql">PostgreSQL</option>
                        <option value="transactsql">SQL Server</option>
                        <option value="transactsql">SQL DW Synapse</option>
                        <option value="bigquery">BigQuery</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleClear} disabled={!input}>
                        Clear
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleDownload} disabled={results.length === 0} title="Download Report">
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                    >
                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                    <Button onClick={analyze} disabled={analyzing}>
                        <Play className="mr-2 h-4 w-4" />
                        {analyzing ? 'Analyzing...' : 'Run Analysis'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="horizontal" className="flex-1 h-full min-h-0 rounded-lg border">
                    <ResizablePanel defaultSize={60} minSize={30}>
                        <Card className="flex flex-col h-full rounded-none border-0 relative">
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

                    <ResizablePanel defaultSize={40} minSize={20}>
                        <Card className="flex flex-col h-full bg-card overflow-hidden relative rounded-none border-0 p-0">
                            <div className="p-4 border-b bg-muted/20">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-green-600" /> Analysis Report
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto p-4 space-y-3">
                                {results.length === 0 ? (
                                    <div className="text-center text-muted-foreground mt-10">
                                        <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                        <p>No issues found! Great job.</p>
                                    </div>
                                ) : (
                                    results.map((r, i) => (
                                        <div key={i} className={`p-4 rounded-lg border shadow-sm ${r.type === 'critical' ? 'bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900/30' :
                                            r.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/10 border-yellow-200 dark:border-yellow-900/30' :
                                                'bg-blue-50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900/30'
                                            }`}>
                                            <div className="flex items-start gap-3">
                                                {r.type === 'critical' && <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                                                {r.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />}
                                                {r.type === 'info' && <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />}
                                                <div>
                                                    <h4 className={`font-semibold text-sm ${r.type === 'critical' ? 'text-red-900 dark:text-red-400' :
                                                        r.type === 'warning' ? 'text-yellow-900 dark:text-yellow-400' :
                                                            'text-blue-900 dark:text-blue-400'
                                                        }`}>{r.message}</h4>
                                                    <p className="text-sm mt-1 text-muted-foreground">{r.recommendation}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
