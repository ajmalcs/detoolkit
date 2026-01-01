import { useState } from 'react'
import { Eraser, ArrowRight, Minimize2, Maximize2, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'

export default function CsvConverter() {
    const [input, setInput] = useState('')
    const [output, setOutput] = useState('')
    const [error, setError] = useState<string | null>(null)

    const parseCSVLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            const nextChar = line[i + 1]

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"' // Escaped quote
                    i++ // Skip next quote
                } else {
                    inQuotes = !inQuotes
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim())
                current = ''
            } else {
                current += char
            }
        }
        result.push(current.trim())
        return result
    }

    const handleConvert = () => {
        try {
            if (!input.trim()) return

            const lines = input.trim().split(/\r?\n/)
            if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row")

            const headers = parseCSVLine(lines[0])
            const result = []

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim()
                if (!line) continue

                const values = parseCSVLine(line)

                const obj: any = {}
                headers.forEach((h, index) => {
                    obj[h] = values[index] !== undefined ? values[index] : null
                })
                result.push(obj)
            }

            setOutput(JSON.stringify(result, null, 2))
            setError(null)
        } catch (err: any) {
            setError(err.message || "Error converting CSV")
            setOutput('')
        }
    }

    const handleClear = () => {
        setInput('')
        setOutput('')
        setError(null)
    }

    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        if (!output) return
        const blob = new Blob([output], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'converted.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">CSV to JSON</h1>
                <div className="flex gap-2 items-center">
                    <Button onClick={handleConvert} className="gap-2">
                        <ArrowRight className="h-4 w-4" /> Convert
                    </Button>
                    <Button variant="outline" onClick={handleClear} className="gap-2">
                        <Eraser className="h-4 w-4" /> Clear
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button variant="outline" size="icon" onClick={handleDownload} disabled={!output} title="Download JSON">
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

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="horizontal" className="flex-1 h-full min-h-0 rounded-lg border">
                    <ResizablePanel defaultSize={50} minSize={20}>
                        <Card className="flex flex-col h-full rounded-none border-0 relative">
                            <div className="flex-1 w-full relative min-h-0">
                                <CodeEditor
                                    value={input}
                                    onChange={(val) => setInput(val || '')}
                                    language="markdown" // CSV highlighting is basic in Monaco, markdown is okay or plain text
                                    fileName="CSV Input"
                                />
                            </div>
                        </Card>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={50} minSize={20}>
                        <Card className="flex flex-col h-full bg-card overflow-hidden relative rounded-none border-0">
                            {error ? (
                                <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 m-4">
                                    {error}
                                </div>
                            ) : (
                                <div className="flex-1 overflow-hidden relative h-full">
                                    <div className="flex-1 w-full h-full relative min-h-0">
                                        <CodeEditor
                                            value={output}
                                            language="json"
                                            readOnly={true}
                                            fileName="JSON Output"
                                        />
                                    </div>
                                </div>
                            )}
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
