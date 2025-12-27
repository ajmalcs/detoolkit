import { useState, useEffect } from 'react'
import { Copy, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
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
    const [type, setType] = useState('postgresql')
    const [host, setHost] = useState('localhost')
    const [port, setPort] = useState('5432')
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

    return (
        <div className="h-full flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full">
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
                <Button variant="outline" size="sm" onClick={handleClear}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                </Button>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="horizontal" className="flex-1 h-full min-h-0 rounded-lg border">
                    <ResizablePanel defaultSize={40} minSize={30}>
                        <Card className="flex flex-col h-full rounded-none border-0 overflow-y-auto">
                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Host</label>
                                    <input
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={host}
                                        onChange={(e) => setHost(e.target.value)}
                                        placeholder="localhost"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Port</label>
                                    <input
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={port}
                                        onChange={(e) => setPort(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Database / SID</label>
                                    <input
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={database}
                                        onChange={(e) => setDatabase(e.target.value)}
                                        placeholder="mydb"
                                    />
                                </div>

                                {type === 'snowflake' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none">Warehouse</label>
                                        <input
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="user"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium leading-none">Password</label>
                                        <input
                                            type="password"
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="password"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Extra Params (URL Encoded)</label>
                                    <input
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={params}
                                        onChange={(e) => setParams(e.target.value)}
                                        placeholder="ssl=true&sslmode=require"
                                    />
                                </div>
                            </div>
                        </Card>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={60} minSize={30}>
                        <Card className="flex flex-col h-full rounded-none border-0 relative bg-card">
                            <label className="text-sm font-medium text-muted-foreground absolute top-2 right-16 z-10 bg-background/80 px-2 rounded">Generated JDBC URL</label>
                            <div className="flex-1 overflow-hidden relative">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-2 right-2 z-20 text-muted-foreground hover:text-foreground"
                                    onClick={handleCopy}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <div className="flex-1 w-full relative min-h-0">
                                    <CodeEditor
                                        value={output}
                                        language="text" // Just plain text or properties
                                        readOnly={true}
                                    />
                                </div>
                            </div>
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
