import { useState } from 'react'
import { Eraser, ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'

export default function CsvConverter() {
    const [input, setInput] = useState('')
    const [output, setOutput] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleConvert = () => {
        try {
            if (!input.trim()) return

            const lines = input.trim().split(/\r?\n/)
            if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row")

            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
            const result = []

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim()
                if (!line) continue

                // Simple CSV split (doesn't handle commas inside quotes perfectly, but good for simple tool)
                // For partial quote support:
                const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''))

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

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full h-full">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">CSV to JSON</h1>
                <div className="flex gap-2">
                    <Button onClick={handleConvert} className="gap-2">
                        <ArrowRight className="h-4 w-4" /> Convert
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
