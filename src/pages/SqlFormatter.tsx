import { useState } from 'react'
import { format } from 'sql-formatter'
import { RotateCcw, Minimize2, Maximize2, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'
import { CodeEditor } from '../components/ui/code-editor'

export default function SqlFormatter() {
    const [input, setInput] = useState('')
    const [output, setOutput] = useState('')
    const [loading, setLoading] = useState(false)
    const [isFullScreen, setIsFullScreen] = useState(false)

    // Handle common ETL placeholders by temporarily replacing them
    const handlePlaceholders = (sql: string): { processedSql: string, placeholders: Map<string, string> } => {
        const placeholders = new Map<string, string>()
        let counter = 0

        // Replace common placeholder patterns with temporary valid SQL values
        let processedSql = sql
            // $PLACEHOLDER$ (common in many ETL tools)
            .replace(/\$[A-Z_][A-Z0-9_]*\$/g, (match) => {
                const temp = `'PLACEHOLDER_${counter++}'`
                placeholders.set(temp, match)
                return temp
            })
            // @{placeholder} (ADF style)
            .replace(/@\{[^}]+\}/g, (match) => {
                const temp = `'PLACEHOLDER_${counter++}'`
                placeholders.set(temp, match)
                return temp
            })
            // {{placeholder}} (Jinja/Airflow style)
            .replace(/\{\{[^}]+\}\}/g, (match) => {
                const temp = `'PLACEHOLDER_${counter++}'`
                placeholders.set(temp, match)
                return temp
            })
            // ${placeholder} (bash/template style)
            .replace(/\$\{[^}]+\}/g, (match) => {
                const temp = `'PLACEHOLDER_${counter++}'`
                placeholders.set(temp, match)
                return temp
            })

        return { processedSql, placeholders }
    }

    const restorePlaceholders = (sql: string, placeholders: Map<string, string>): string => {
        let result = sql
        placeholders.forEach((original, temp) => {
            result = result.replace(new RegExp(temp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), original)
        })
        return result
    }

    const handleFormat = () => {
        if (!input.trim()) return

        setLoading(true)

        setTimeout(() => {
            try {
                // Handle placeholders
                const { processedSql, placeholders } = handlePlaceholders(input)

                const formatted = format(processedSql, {
                    language: 'sql',
                    keywordCase: 'upper',
                })

                // Restore original placeholders
                const finalOutput = restorePlaceholders(formatted, placeholders)
                setOutput(finalOutput)
            } catch (e) {
                setOutput(`-- Error formatting SQL:\n-- ${(e as Error).message}`)
            } finally {
                setLoading(false)
            }
        }, 10)
    }

    const handleClear = () => {
        setInput('')
        setOutput('')
    }

    const handleDownload = () => {
        if (!output) return
        const blob = new Blob([output], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'formatted.sql'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">SQL Formatter</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleClear}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button variant="outline" size="icon" onClick={handleDownload} disabled={!output} title="Download Formatted SQL">
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
                    <Button onClick={handleFormat} disabled={loading}>
                        {loading ? 'Formatting...' : 'Format SQL'}
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
                                    language="sql"
                                    fileName="Raw SQL"
                                />
                            </div>
                        </Card>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={50} minSize={20}>
                        <Card className="flex flex-col h-full bg-card overflow-hidden relative rounded-none border-0">
                            <div className="flex-1 overflow-hidden relative h-full">
                                <CodeEditor
                                    value={output}
                                    language="sql"
                                    readOnly={true}
                                    fileName="Formatted SQL"
                                />
                            </div>
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
