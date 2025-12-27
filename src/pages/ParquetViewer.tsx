import { useEffect, useState, useCallback } from 'react'
import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import { FileDown, Database, Play } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_eh,
        mainWorker: eh_worker,
    },
}

export default function ParquetViewer() {
    const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null)
    const [conn, setConn] = useState<duckdb.AsyncDuckDBConnection | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('SELECT * FROM parquet_file LIMIT 100')
    const [result, setResult] = useState<Record<string, unknown>[] | null>(null)
    const [columns, setColumns] = useState<string[]>([])

    // Drag and drop state
    const [isDragging, setIsDragging] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)

    // Initialize DuckDB
    useEffect(() => {
        const init = async () => {
            try {
                const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
                const worker = new Worker(bundle.mainWorker!)
                const logger = new duckdb.ConsoleLogger()
                const db = new duckdb.AsyncDuckDB(logger, worker)
                await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
                const conn = await db.connect()

                setDb(db)
                setConn(conn)
                setLoading(false)
            } catch (err: unknown) {
                console.error(err)
                const message = err instanceof Error ? err.message : String(err)
                setError("Failed to initialize DuckDB: " + message)
                setLoading(false)
            }
        }
        init()
    }, [])

    const handleFile = useCallback(async (file: File) => {
        if (!db || !conn) return

        try {
            setLoading(true)
            setFileName(file.name)

            // Register file
            await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true)

            // Create a table or view? Or just query the file directly
            // We can just use the filename in the query but let's make it easier by creating a consistent view name?
            // Actually users might want to query 'SELECT * FROM "file.parquet"'

            // Let's set the default query to select from this file
            const tableName = `"${file.name}"`
            setQuery(`SELECT * FROM ${tableName} LIMIT 100`)

            // Execute default query immediately
            const result = await conn.query(`SELECT * FROM ${tableName} LIMIT 100`)
            const resultArray = result.toArray().map((row: { toJSON: () => Record<string, unknown> }) => row.toJSON())

            setResult(resultArray)
            if (resultArray.length > 0) {
                setColumns(Object.keys(resultArray[0]))
            }

            setLoading(false)
        } catch (err: unknown) {
            console.error(err)
            const message = err instanceof Error ? err.message : String(err)
            setError("Error loading file: " + message)
            setLoading(false)
        }
    }, [db, conn])

    const runQuery = async () => {
        if (!conn) return
        try {
            setError(null)
            const result = await conn.query(query)
            const resultArray = result.toArray().map((row: { toJSON: () => Record<string, unknown> }) => row.toJSON())
            setResult(resultArray)
            if (resultArray.length > 0) {
                setColumns(Object.keys(resultArray[0]))
            } else {
                setColumns([])
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            setError(message)
            setResult(null)
        }
    }

    // Drag handlers
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }
    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0])
        }
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">Parquet Viewer</h1>
                    <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {loading ? 'Initializing DuckDB...' : 'DuckDB Ready'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={runQuery} disabled={!conn || loading}>
                        <Play className="mr-2 h-4 w-4" /> Run Query
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="vertical" className="flex-1 h-full min-h-0 rounded-lg border">
                    {/* Top Panel: Drag Drop & Query */}
                    <ResizablePanel defaultSize={40} minSize={20}>
                        <ResizablePanelGroup direction="horizontal">
                            <ResizablePanel defaultSize={40} minSize={20}>
                                <div
                                    className={`h-full flex flex-col items-center justify-center border-r p-6 text-center transition-colors
                                        ${isDragging ? 'bg-primary/10 border-primary' : 'bg-muted/30'}
                                        ${!fileName ? 'cursor-pointer' : ''}
                                    `}
                                    onDragOver={onDragOver}
                                    onDragLeave={onDragLeave}
                                    onDrop={onDrop}
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                >
                                    <input
                                        type="file"
                                        id="file-upload"
                                        className="hidden"
                                        accept=".parquet,.ipc,.arrow,.csv,.json"
                                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                    />
                                    <div className="p-4 rounded-full bg-background border shadow-sm mb-4">
                                        <FileDown className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="font-semibold text-lg mb-1">
                                        {fileName ? fileName : "Drop Parquet file here"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground max-w-[200px]">
                                        {fileName ? "Drag another file to replace" : "Supports Parquet, Arrow, CSV, JSON"}
                                    </p>
                                </div>
                            </ResizablePanel>

                            <ResizableHandle withHandle />

                            <ResizablePanel defaultSize={60} minSize={20}>
                                <Card className="flex flex-col h-full rounded-none border-0 relative">
                                    <label className="text-sm font-medium text-muted-foreground absolute top-2 right-4 z-10 bg-background/80 px-2 rounded">SQL Query</label>
                                    <label className="text-sm font-medium text-muted-foreground absolute top-2 right-4 z-10 bg-background/80 px-2 rounded">SQL Query</label>
                                    <div className="flex-1 w-full relative min-h-0">
                                        <CodeEditor
                                            value={query}
                                            onChange={(val) => setQuery(val || '')}
                                            language="sql"
                                        />
                                    </div>
                                </Card>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Bottom Panel: Results Table */}
                    <ResizablePanel defaultSize={60} minSize={20}>
                        <Card className="flex flex-col h-full bg-card overflow-hidden hover:overflow-auto rounded-none border-0 relative">
                            {error ? (
                                <div className="text-destructive p-4 m-4 border border-destructive rounded-md bg-destructive/10">
                                    {error}
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto w-full">
                                    {result && result.length > 0 ? (
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-muted sticky top-0 z-20 shadow-sm">
                                                <tr>
                                                    {columns.map(col => (
                                                        <th key={col} className="px-4 py-3 font-semibold text-foreground whitespace-nowrap border-b bg-muted">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {result.map((row, i) => (
                                                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                                                        {columns.map(col => (
                                                            <td key={`${i}-${col}`} className="px-4 py-2 whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis border-b border-border/50">
                                                                {row[col] === null ? <span className="text-muted-foreground italic">null</span> : String(row[col])}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : result !== null ? (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            No results found.
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            Run a query to see results.
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
