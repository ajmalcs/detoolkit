import { useState, useCallback, useEffect } from 'react'
import mermaid from 'mermaid'
import { Parser } from 'node-sql-parser'
import { Play, Database, Network, Filter } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'
import { CodeEditor } from '../components/ui/code-editor'

const parser = new Parser()

mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    securityLevel: 'loose',
})

export default function SqlLineage() {
    const [input, setInput] = useState(`SELECT u.username, o.order_id, p.product_name
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.status = 'completed' AND o.total > 100`)
    const [dialect, setDialect] = useState('transactsql')
    const [svg, setSvg] = useState('')
    const [error, setError] = useState('')

    // Detailed stats
    const [stats, setStats] = useState({
        tables: 0,
        joins: 0,
        filters: 0
    })

    // Detailed Data for Summary View
    const [details, setDetails] = useState<{
        tables: { name: string, alias: string, isParent: boolean }[],
        joins: { from: string, to: string, on: string }[],
        filters: string[]
    }>({ tables: [], joins: [], filters: [] })

    const [activeTab, setActiveTab] = useState<'graph' | 'details'>('graph')

    // Helper to stringify AST expressions (Naive implementation)
    const exprToString = (expr: any): string => {
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
        // Fallback for complex things not covered
        return '?'
    }

    const analyze = useCallback(async () => {
        setError('')
        try {
            const ast = parser.astify(input, { database: dialect as any })
            const statements = Array.isArray(ast) ? ast : [ast]

            const nodes = new Set<string>()
            const edges: { from: string, to: string, label: string }[] = []

            const foundDetails = {
                tables: [] as { name: string, alias: string, isParent: boolean }[],
                joins: [] as { from: string, to: string, on: string }[],
                filters: [] as string[]
            }

            statements.forEach((stmt: any) => {
                if (stmt.type === 'select') {
                    // 1. Collect all tables & Aliases
                    if (stmt.from) {
                        stmt.from.forEach((f: any, index: number) => {
                            const name = f.table
                            const alias = f.as
                            const id = alias || name
                            if (id) nodes.add(id)

                            foundDetails.tables.push({
                                name: name,
                                alias: alias || '-',
                                isParent: index === 0 // First table is parent
                            })
                        })

                        // 2. Build flow & Joins
                        for (let i = 1; i < stmt.from.length; i++) {
                            const prev = stmt.from[i - 1]
                            const curr = stmt.from[i]

                            const fromId = prev.as || prev.table
                            const toId = curr.as || curr.table

                            let label = curr.join || 'related'
                            let onCondition = '-'

                            if (curr.on) {
                                // Use our helper to reconstruct the condition
                                const conditionStr = exprToString(curr.on)
                                label = conditionStr.length > 20 ? conditionStr.substring(0, 17) + '...' : conditionStr
                                onCondition = conditionStr
                            }

                            edges.push({ from: fromId, to: toId, label })
                            foundDetails.joins.push({ from: fromId, to: toId, on: onCondition })
                        }
                    }

                    // 3. Extract Filters (WHERE)
                    if (stmt.where) {
                        const extractFilters = (expr: any) => {
                            if (!expr) return

                            if (expr.type === 'binary_expr') {
                                // Check if it's a logical operator to recurse
                                if (['AND', 'OR'].includes(expr.operator)) {
                                    if (expr.left) extractFilters(expr.left)
                                    if (expr.right) extractFilters(expr.right)
                                } else {
                                    // It's a condition, stringify it
                                    foundDetails.filters.push(exprToString(expr))
                                }
                            }
                        }
                        extractFilters(stmt.where)
                    }
                }
            })

            if (nodes.size === 0) {
                setSvg('')
                return
            }

            // Build Mermaid String
            let graphDefinition = 'graph LR\n'

            nodes.forEach(n => {
                graphDefinition += `    ${n}[${n}]\n`
            })

            edges.forEach(e => {
                const cleanLabel = e.label.replace(/["\n]/g, '')
                graphDefinition += `    ${e.from} -->|${cleanLabel}| ${e.to}\n`
            })

            graphDefinition += '    classDef default fill:#1e293b,stroke:#94a3b8,color:#fff;\n'

            const { svg } = await mermaid.render('mermaid-chart', graphDefinition)
            setSvg(svg)

            setDetails(foundDetails)
            setStats({
                tables: foundDetails.tables.length,
                joins: foundDetails.joins.length,
                filters: foundDetails.filters.length
            })

        } catch (e: any) {
            console.error("Parse Error", e)
            setError(e.message || 'Error parsing SQL')
        }
    }, [input, dialect])

    useEffect(() => {
        analyze()
    }, [])

    const handleClear = () => {
        setInput('')
        setSvg('')
        setStats({ tables: 0, joins: 0, filters: 0 })
        setDetails({ tables: [], joins: [], filters: [] })
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">SQL Lineage & Extractor</h1>
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
                <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground flex gap-4 mr-4">
                        <span className="flex items-center gap-1"><Database className="h-4 w-4" /> {stats.tables} Tables</span>
                        <span className="flex items-center gap-1"><Network className="h-4 w-4" /> {stats.joins} Joins</span>
                        <span className="flex items-center gap-1"><Filter className="h-4 w-4" /> {stats.filters} Filters</span>
                    </div>
                    <Button variant="outline" onClick={handleClear}>Clear</Button>
                    <Button onClick={analyze}>
                        <Play className="mr-2 h-4 w-4" />
                        Update Graph
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="vertical" className="flex-1 h-full min-h-0 rounded-lg border">
                    <ResizablePanel defaultSize={40} minSize={20}>
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

                    <ResizablePanel defaultSize={60} minSize={30}>
                        <Card className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative rounded-none border-0">
                            <div className="flex items-center border-b bg-muted/40 px-4">
                                <button
                                    onClick={() => setActiveTab('graph')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'graph' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    Visual Graph
                                </button>
                                <button
                                    onClick={() => setActiveTab('details')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    Detailed Summary
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-4">
                                {activeTab === 'graph' ? (
                                    error ? (
                                        <div className="text-red-500">{error}</div>
                                    ) : (
                                        <div
                                            className="w-full h-full flex items-center justify-center mermaid-container"
                                            dangerouslySetInnerHTML={{ __html: svg }}
                                        />
                                    )
                                ) : (
                                    <div className="space-y-6 max-w-3xl mx-auto">
                                        <div>
                                            <h3 className="font-semibold mb-2 flex items-center gap-2"><Database className="h-4 w-4" /> Tables Found</h3>
                                            <div className="border rounded-md bg-background">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50 text-left">
                                                        <tr>
                                                            <th className="p-2 font-medium">Table Name</th>
                                                            <th className="p-2 font-medium">Alias</th>
                                                            <th className="p-2 font-medium">Type</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {details.tables.map((t, i) => (
                                                            <tr key={i} className={`border-t ${t.isParent ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                                                <td className="p-2 font-mono">
                                                                    {t.name}
                                                                    {t.isParent && <span className="ml-2 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Parent</span>}
                                                                </td>
                                                                <td className="p-2 font-mono text-muted-foreground">{t.alias}</td>
                                                                <td className="p-2 text-xs text-muted-foreground">{t.isParent ? 'Main Table' : 'Joined'}</td>
                                                            </tr>
                                                        ))}
                                                        {details.tables.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No tables found</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold mb-2 flex items-center gap-2"><Network className="h-4 w-4" /> Join Conditions</h3>
                                            <div className="border rounded-md bg-background">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50 text-left">
                                                        <tr>
                                                            <th className="p-2 font-medium">From</th>
                                                            <th className="p-2 font-medium">To</th>
                                                            <th className="p-2 font-medium">Condition</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {details.joins.map((j, i) => (
                                                            <tr key={i} className="border-t">
                                                                <td className="p-2 font-mono">{j.from}</td>
                                                                <td className="p-2 font-mono">{j.to}</td>
                                                                <td className="p-2 font-mono text-muted-foreground text-xs font-semibold">{j.on}</td>
                                                            </tr>
                                                        ))}
                                                        {details.joins.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No joins found</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="font-semibold mb-2 flex items-center gap-2"><Filter className="h-4 w-4" /> Filters (WHERE)</h3>
                                            <div className="border rounded-md bg-background p-2">
                                                {details.filters.length > 0 ? (
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {details.filters.map((f, i) => (
                                                            <li key={i} className="text-sm font-mono text-muted-foreground">{f}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground p-2">No active filters found.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
