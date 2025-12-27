import { useState } from 'react'
import { Copy, Eraser, Play, Table as TableIcon, Code } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'
import { CodeEditor } from '../components/ui/code-editor'

export default function JsonUtils() {
    const [input, setInput] = useState('')
    const [formatted, setFormatted] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [tableData, setTableData] = useState<any[] | null>(null)
    const [tableHeaders, setTableHeaders] = useState<string[]>([])

    const [loading, setLoading] = useState(false)

    const handleFormat = () => {
        if (!input.trim()) return

        setLoading(true)
        // Use setTimeout to yield to main thread so loading spinner can render
        setTimeout(() => {
            try {
                const parsed = JSON.parse(input)
                setFormatted(JSON.stringify(parsed, null, 2))

                // Prepare table data if array
                if (Array.isArray(parsed)) {
                    setTableData(parsed)
                    // Optimization: Only scan up to 100 items for headers to avoid freezing on massive arrays
                    const keys = new Set<string>()
                    const scanLimit = Math.min(parsed.length, 100)
                    for (let i = 0; i < scanLimit; i++) {
                        const item = parsed[i]
                        if (typeof item === 'object' && item !== null) {
                            Object.keys(item).forEach(k => keys.add(k))
                        }
                    }
                    setTableHeaders(Array.from(keys))
                } else {
                    setTableData(null) // Not an array
                }

                setError(null)
            } catch (err: any) {
                setError(err.message || 'Invalid JSON')
                setFormatted('')
                setTableData(null)
            } finally {
                setLoading(false)
            }
        }, 10)
    }

    const handleCopy = () => {
        if (formatted) {
            navigator.clipboard.writeText(formatted)
        }
    }

    const handleClear = () => {
        setInput('')
        setFormatted('')
        setError(null)
        setTableData(null)
        setTableHeaders([])
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full h-full">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">JSON Utilities</h1>
                <div className="flex gap-2">
                    <Button onClick={handleFormat} className="gap-2" disabled={loading}>
                        {loading ? <Play className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {loading ? 'Processing...' : 'Format/Validate'}
                    </Button>
                    <Button variant="outline" onClick={handleClear} className="gap-2">
                        <Eraser className="h-4 w-4" /> Clear
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="horizontal" className="flex-1 h-full min-h-0 rounded-lg border">
                    <ResizablePanel defaultSize={50} minSize={20}>
                        <Card className="flex flex-col h-full rounded-none border-0 relative">
                            <label className="text-sm font-medium text-muted-foreground absolute top-2 right-4 z-10 bg-background/80 px-2 rounded">Input JSON</label>
                            <label className="text-sm font-medium text-muted-foreground absolute top-2 right-4 z-10 bg-background/80 px-2 rounded">Input JSON</label>
                            <div className="flex-1 w-full relative min-h-0">
                                <CodeEditor
                                    value={input}
                                    onChange={(val) => setInput(val || '')}
                                    language="json"
                                />
                            </div>
                        </Card>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={50} minSize={20}>
                        <Card className="flex flex-col h-full bg-card overflow-hidden rounded-none border-0">
                            <Tabs defaultValue="prettify" className="h-full flex flex-col">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="prettify">
                                        <Code className="mr-2 h-4 w-4" /> Prettify
                                    </TabsTrigger>
                                    <TabsTrigger value="table" disabled={!tableData}>
                                        <TableIcon className="mr-2 h-4 w-4" /> Tabular View
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="prettify" className="flex-1 mt-0 min-h-0 relative">
                                    {error ? (
                                        <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 m-4">
                                            {error}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col relative overflow-hidden">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="absolute top-2 right-4 z-20 text-muted-foreground hover:text-foreground"
                                                onClick={handleCopy}
                                                disabled={!formatted}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                            <div className="flex-1 w-full relative min-h-0">
                                                <CodeEditor
                                                    value={formatted}
                                                    language="json"
                                                    readOnly={true}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="table" className="flex-1 mt-0 min-h-0 relative overflow-hidden">
                                    {tableData ? (
                                        <div className="h-full overflow-auto rounded-md border m-4 bg-background">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-muted sticky top-0">
                                                    <tr>
                                                        {tableHeaders.map(h => (
                                                            <th key={h} className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {tableData.map((row, i) => (
                                                        <tr key={i} className="hover:bg-muted/50">
                                                            {tableHeaders.map(h => (
                                                                <td key={`${i}-${h}`} className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                                                    {typeof row[h] === 'object' ? JSON.stringify(row[h]) : String(row[h] ?? '')}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md m-4">
                                            Input must be a valid JSON array to view as table.
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
