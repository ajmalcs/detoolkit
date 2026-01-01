import { useState, useEffect } from 'react'
import { Copy, RotateCcw, Minimize2, Maximize2, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'

const dbTypes = [
    { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432, template: 'jdbc:postgresql://{host}:{port}/{database}' },
    { value: 'mysql', label: 'MySQL', defaultPort: 3306, template: 'jdbc:mysql://{host}:{port}/{database}' },
    { value: 'sqlserver', label: 'SQL Server', defaultPort: 1433, template: 'jdbc:sqlserver://{host}:{port};databaseName={database}' },
    { value: 'oracle', label: 'Oracle', defaultPort: 1521, template: 'jdbc:oracle:thin:@{host}:{port}:{database}' },
    { value: 'redshift', label: 'AWS Redshift', defaultPort: 5439, template: 'jdbc:redshift://{host}:{port}/{database}' },
    { value: 'snowflake', label: 'Snowflake', defaultPort: 443, template: 'jdbc:snowflake://{host}.snowflakecomputing.com/?db={database}&warehouse={warehouse}' },
]

export default function JdbcBuilder() {
    const [type, setType] = useState('sqlserver')
    const [host, setHost] = useState('localhost')
    const [port, setPort] = useState('1433')
    const [database, setDatabase] = useState('mydb')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [params, setParams] = useState('')

    // Snowflake specific
    const [warehouse, setWarehouse] = useState('')

    const [output, setOutput] = useState('')

    useEffect(() => {
        const selected = dbTypes.find(t => t.value === type)
        if (!selected) return

        let url = selected.template
            .replace('{host}', host || 'localhost')
            .replace('{port}', port || String(selected.defaultPort))
            .replace('{database}', database || '')

        if (type === 'snowflake') {
            url = url.replace('{warehouse}', warehouse || '')
        }

        // Add params
        const paramsList = []
        if (username) paramsList.push(`user=${username}`)
        if (password) paramsList.push(`password=${password}`)

        if (params) {
            // Check if params string starts with ? or &
            const cleanParams = params.trim().replace(/^[?&]/, '')
            if (cleanParams) paramsList.push(cleanParams)
        }

        if (paramsList.length > 0) {
            // Check if url already has params
            const separator = url.includes('?') ? '&' : '?'
            url += separator + paramsList.join('&')
        }

        setOutput(url)
    }, [type, host, port, database, username, password, params, warehouse])

    const handleTypeChange = (newType: string) => {
        setType(newType)
        const def = dbTypes.find(t => t.value === newType)
        if (def) {
            setPort(String(def.defaultPort))
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(output)
    }

    const handleClear = () => {
        setHost('localhost')
        const def = dbTypes.find(t => t.value === type)
        setPort(String(def?.defaultPort || ''))
        setDatabase('mydb')
        setUsername('')
        setPassword('')
        setParams('')
        setWarehouse('')
    }

    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        if (!output) return
        const blob = new Blob([output], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'jdbc_connection.txt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">JDBC String Builder</h1>
                    <select
                        value={type}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        className="h-9 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        {dbTypes.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleClear}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button variant="outline" size="icon" onClick={handleDownload} disabled={!output} title="Download Connection String">
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
                </div>
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
                <ResizablePanel defaultSize={40} minSize={30}>
                    <div className="flex flex-col h-full p-6 space-y-4 overflow-y-auto">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Host</label>
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={host}
                                onChange={(e) => setHost(e.target.value)}
                                placeholder="localhost"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Port</label>
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Database / SID</label>
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={database}
                                onChange={(e) => setDatabase(e.target.value)}
                                placeholder="mydb"
                            />
                        </div>

                        {type === 'snowflake' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Warehouse</label>
                                <input
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={warehouse}
                                    onChange={(e) => setWarehouse(e.target.value)}
                                    placeholder="COMPUTE_WH"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Username</label>
                                <input
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="user"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Password</label>
                                <input
                                    type="password"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="password"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">Extra Params (URL Encoded)</label>
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                value={params}
                                onChange={(e) => setParams(e.target.value)}
                                placeholder="ssl=true&sslmode=require"
                            />
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={60} minSize={30}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                            <span className="text-xs font-medium text-muted-foreground uppercase">Generated JDBC URL</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopy} title="Copy JDBC URL">
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 relative">
                            <CodeEditor value={output} language="text" readOnly={true} hideHeader={true} />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}
