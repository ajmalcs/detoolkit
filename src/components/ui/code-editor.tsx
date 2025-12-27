import Editor, { type OnChange } from "@monaco-editor/react"
import { useTheme } from "../theme-provider"
import { cn } from "../../lib/utils"


interface CodeEditorProps {
    value: string
    onChange?: (value: string | undefined) => void
    language?: string
    readOnly?: boolean
    minimap?: boolean
}

export function CodeEditor({
    value,
    onChange,
    language = "sql",
    readOnly = false,
    minimap = true
}: CodeEditorProps) {
    const { theme } = useTheme()

    const handleEditorChange: OnChange = (value) => {
        if (onChange) {
            onChange(value)
        }
    }

    // Map our theme (light/dark/system) to Monaco theme
    const monacoTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? "vs-dark"
        : "light"

    return (
        <div className="h-full w-full min-h-0 relative overflow-hidden">
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

import { DiffEditor } from "@monaco-editor/react"

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
        <div className={cn("min-h-0 overflow-hidden", className)}>
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
    )
}
