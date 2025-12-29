import Editor, { type OnChange, DiffEditor } from "@monaco-editor/react"
import { useTheme } from "../theme-provider"
import { cn } from "../../lib/utils"
import { Copy, Check, FileUp, Download } from "lucide-react"
import { useState, useRef } from "react"
import { Button } from "../ui/button"

interface CodeEditorProps {
    value: string
    onChange?: (value: string | undefined) => void
    language?: string
    readOnly?: boolean
    minimap?: boolean
    allowCopy?: boolean
    allowFileUpload?: boolean
    allowDownload?: boolean
    fileName?: string
}

export function CodeEditor({
    value,
    onChange,
    language = "sql",
    readOnly = false,
    minimap = true,
    allowCopy = true,
    allowFileUpload,
    allowDownload = false,
    fileName
}: CodeEditorProps) {
    const { theme } = useTheme()
    const [copied, setCopied] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Default file upload to enabled if editable, disabled if readOnly, unless explicitly set
    const canUpload = allowFileUpload !== undefined ? allowFileUpload : !readOnly

    const handleEditorChange: OnChange = (value) => {
        if (onChange) {
            onChange(value)
        }
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result
            if (typeof text === 'string' && onChange) {
                onChange(text)
            }
        }
        reader.readAsText(file) // Force reset input value to allow same file selection
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleDownload = () => {
        const blob = new Blob([value], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName || `snippet.${language === 'sql' ? 'sql' : 'txt'}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // Map our theme (light/dark/system) to Monaco theme
    const monacoTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? "vs-dark"
        : "light"

    return (
        <div className="h-full w-full min-h-0 flex flex-col border rounded-md overflow-hidden bg-background">
            {/* Toolbar Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b shrink-0 h-9">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {fileName || language}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {canUpload && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                                accept={language === 'sql' ? '.sql,.txt' : '.txt,.json,.csv,.js,.ts,.md'}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs gap-1.5 hover:bg-background hover:text-foreground hover:shadow-sm transition-all"
                                onClick={() => fileInputRef.current?.click()}
                                title="Open File"
                            >
                                <FileUp className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Open File</span>
                            </Button>
                        </>
                    )}
                    {allowDownload && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-background hover:text-foreground hover:shadow-sm transition-all"
                            onClick={handleDownload}
                            title="Download"
                        >
                            <Download className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    {allowCopy && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-background hover:text-foreground hover:shadow-sm transition-all"
                            onClick={handleCopy}
                            title="Copy Content"
                        >
                            {copied ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                                <Copy className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 w-full relative min-h-0">
                <Editor
                    height="100%"
                    defaultLanguage={language}
                    language={language}
                    value={value}
                    theme={monacoTheme}
                    onChange={handleEditorChange}
                    options={{
                        readOnly,
                        minimap: { enabled: minimap },
                        fontSize: 14,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 }
                    }}
                />
            </div>
        </div>
    )
}

interface DiffCodeEditorProps {
    original: string
    modified: string
    language?: string
    readOnly?: boolean
    renderSideBySide?: boolean
    className?: string
    onMount?: (editor: any, monaco: any) => void
    ignoreTrimWhitespace?: boolean
}

export function DiffCodeEditor({
    original,
    modified,
    language = "text",
    readOnly = true,
    renderSideBySide = true,
    className,
    onMount,
    ignoreTrimWhitespace = false
}: DiffCodeEditorProps) {
    const { theme } = useTheme()

    const monacoTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? "vs-dark"
        : "light"

    return (
        <div className={cn("min-h-0 flex flex-col overflow-hidden relative group border rounded-md bg-background", className)}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b shrink-0 h-9">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {language} Diff
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/50"></span> Original
                        <span className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/50"></span> Modified
                    </span>
                </div>
            </div>

            <div className="flex-1 w-full relative min-h-0">
                <DiffEditor
                    height="100%"
                    language={language}
                    original={original}
                    modified={modified}
                    theme={monacoTheme}
                    onMount={onMount}
                    options={{
                        readOnly,
                        originalEditable: !readOnly,
                        renderSideBySide,
                        ignoreTrimWhitespace,
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 },
                        diffWordWrap: "off",
                    }}
                />
            </div>
        </div>
    )
}
