import { useState, useRef, useMemo } from 'react'
import { Eraser, Columns, Rows, FileCode, ArrowRightLeft, AlignLeft, AlertCircle, Upload, ArrowRight, ArrowLeft, Filter, Minimize2, Maximize2 } from 'lucide-react'
import { format as formatSql, type SqlLanguage } from 'sql-formatter'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { DiffCodeEditor } from '../components/ui/code-editor'

const languages = [
    { value: 'text', label: 'Plain Text' },
    { value: 'json', label: 'JSON' },
    { value: 'sql', label: 'SQL' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'xml', label: 'XML' },
    { value: 'yaml', label: 'YAML' },
]

const sqlDialects: { value: SqlLanguage, label: string }[] = [
    { value: 'sql', label: 'Standard SQL' },
    { value: 'bigquery', label: 'BigQuery' },
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'mariadb', label: 'MariaDB' },
    { value: 'sqlite', label: 'SQLite' },
    { value: 'snowflake', label: 'Snowflake' },
    { value: 'redshift', label: 'Redshift' },
    { value: 'transactsql', label: 'T-SQL (SQL Server)' },
    { value: 'transactsql', label: 'Synapse SQL (Dedicated Pool)' },
    { value: 'plsql', label: 'PL/SQL (Oracle)' },
    { value: 'spark', label: 'Spark SQL' },
]

export default function DiffChecker() {
    const [original, setOriginal] = useState('')
    const [modified, setModified] = useState('')
    const [language, setLanguage] = useState('text')
    const [sqlDialect, setSqlDialect] = useState<SqlLanguage>('sql')
    const [sideBySide, setSideBySide] = useState(true)
    const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [regexPattern, setRegexPattern] = useState('')
    const [applyFilter, setApplyFilter] = useState(false)

    const originalFileRef = useRef<HTMLInputElement>(null)
    const modifiedFileRef = useRef<HTMLInputElement>(null)

    // Refs to store current values to avoid re-rendering loop issues if we synced strictly on every keystroke
    // But for this simple app, state sync is fine.

    const handleClear = () => {
        setOriginal('')
        setModified('')
        setError(null)
    }

    const handleFormat = () => {
        setError(null)
        if (language === 'json') {
            try {
                const fmtOriginal = original ? JSON.stringify(JSON.parse(original), null, 2) : ''
                const fmtModified = modified ? JSON.stringify(JSON.parse(modified), null, 2) : ''
                setOriginal(fmtOriginal)
                setModified(fmtModified)
            } catch (e: any) {
                // Ignore parse errors, user might be typing
                console.error("JSON Parse Error", e)
                setError(`JSON Error: ${e.message}`)
            }
        } else if (language === 'sql') {
            try {
                const fmtOriginal = original ? formatSql(original, { language: sqlDialect, keywordCase: 'upper' }) : ''
                const fmtModified = modified ? formatSql(modified, { language: sqlDialect, keywordCase: 'upper' }) : ''
                setOriginal(fmtOriginal)
                setModified(fmtModified)
            } catch (e: any) {
                console.error("SQL Format Error", e)
                setError(`SQL Format Error: ${e.message}`)
            }
        }
    }

    const handleSwap = () => {
        setOriginal(modified)
        setModified(original)
    }

    const handleCopyLeftToRight = () => {
        setModified(original)
    }

    const handleCopyRightToLeft = () => {
        setOriginal(modified)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isOriginal: boolean) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result
            if (typeof text === 'string') {
                if (isOriginal) setOriginal(text)
                else setModified(text)
            }
        }
        reader.readAsText(file)
        e.target.value = '' // Reset input
    }

    const handleEditorDidMount = (editor: any) => {
        const originalModel = editor.getOriginalEditor().getModel();
        const modifiedModel = editor.getModifiedEditor().getModel();

        // Listen to changes in the "Original" (Left) editor
        originalModel.onDidChangeContent(() => {
            // Only update state if the change didn't come from our filter mechanism (which ideally shouldn't trigger this if we manage proper flow, but for now we sync back)
            // Actually, if we are viewing filtered content, we probably shouldn't be editing? 
            // The DiffCodeEditor is set to readOnly={false}, but if we show filtered content, editing it might be confusing. 
            // relevant logic: if applyFilter is true, we display formatted values. Editing those values changes 'original' state?
            // If user types in filtered view, they are editing the filtered string. 
            // For simplicity, updates in editor update the state. If filter is on, you are editing the filtered text. 
            if (!applyFilter) {
                setOriginal(originalModel.getValue());
            }
        });

        // Listen to changes in the "Modified" (Right) editor
        modifiedModel.onDidChangeContent(() => {
            if (!applyFilter) {
                setModified(modifiedModel.getValue());
            }
        });
    }

    const filteredOriginal = useMemo(() => {
        if (!applyFilter || !regexPattern) return original
        try {
            const re = new RegExp(regexPattern, 'g')
            return original.replace(re, '')
        } catch (e) {
            return original
        }
    }, [original, regexPattern, applyFilter])

    const filteredModified = useMemo(() => {
        if (!applyFilter || !regexPattern) return modified
        try {
            const re = new RegExp(regexPattern, 'g')
            return modified.replace(re, '')
        } catch (e) {
            return modified
        }
    }, [modified, regexPattern, applyFilter])


    const [isFullScreen, setIsFullScreen] = useState(false)

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex flex-col gap-2">
                {/* Top Toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ArrowRightLeft className="h-6 w-6 text-primary" />
                            Diff Checker
                        </h1>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            {languages.map((l) => (
                                <option key={l.value} value={l.value}>{l.label}</option>
                            ))}
                        </select>

                        {language === 'sql' && (
                            <select
                                value={sqlDialect}
                                onChange={(e) => setSqlDialect(e.target.value as SqlLanguage)}
                                className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {sqlDialects.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Mode */}
                        <div className="flex mx-2 border rounded-md overflow-hidden bg-background">
                            <button
                                onClick={() => setSideBySide(true)}
                                className={`px-3 py-1.5 text-sm ${sideBySide ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}
                                title="Side by Side"
                            >
                                <Columns className="h-4 w-4" />
                            </button>
                            <div className="w-px bg-border" />
                            <button
                                onClick={() => setSideBySide(false)}
                                className={`px-3 py-1.5 text-sm ${!sideBySide ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted'}`}
                                title="Inline"
                            >
                                <Rows className="h-4 w-4" />
                            </button>
                        </div>

                        <Button
                            variant={ignoreWhitespace ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
                            title="Ignore Whitespace"
                        >
                            <AlignLeft className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleSwap} title="Swap Sides">
                            <ArrowRightLeft className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleFormat} disabled={language !== 'json' && language !== 'sql'}>
                            <FileCode className="mr-2 h-4 w-4" />
                            Format
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleClear}>
                            <Eraser className="mr-2 h-4 w-4" />
                            Clear
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

                {/* Secondary Action Bar: Uploads, Merge, Filter */}
                <div className="flex items-center justify-between p-2 bg-muted/40 rounded-md border text-sm gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        {/* Hidden Inputs */}
                        <input type="file" ref={originalFileRef} className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                        <input type="file" ref={modifiedFileRef} className="hidden" onChange={(e) => handleFileUpload(e, false)} />

                        <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={() => originalFileRef.current?.click()}>
                            <Upload className="h-3.5 w-3.5" />
                            Original
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyLeftToRight} title="Copy Original to Modified">
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-1 justify-center min-w-[200px]">
                        <div className="flex items-center gap-2 w-full max-w-sm">
                            <Filter className={`h-4 w-4 ${applyFilter ? 'text-primary' : 'text-muted-foreground'}`} />
                            <Input
                                placeholder="Ignore Regex Pattern..."
                                value={regexPattern}
                                onChange={(e) => setRegexPattern(e.target.value)}
                                className="h-8 text-xs font-mono"
                            />
                            <Button
                                variant={applyFilter ? "default" : "outline"}
                                size="sm"
                                className="h-8 text-xs whitespace-nowrap"
                                onClick={() => setApplyFilter(!applyFilter)}
                                disabled={!regexPattern}
                            >
                                {applyFilter ? "Filter On" : "Filter Off"}
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyRightToLeft} title="Copy Modified to Original">
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={() => modifiedFileRef.current?.click()}>
                            <Upload className="h-3.5 w-3.5" />
                            Modified
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                )}
            </div>

            <div className="flex-1 border rounded-lg overflow-hidden bg-background relative min-h-0">
                <DiffCodeEditor
                    original={applyFilter ? filteredOriginal : original}
                    modified={applyFilter ? filteredModified : modified}
                    language={language}
                    readOnly={false} // Enable editing!
                    renderSideBySide={sideBySide}
                    ignoreTrimWhitespace={ignoreWhitespace}
                    className="absolute inset-0"
                    onMount={handleEditorDidMount}
                />
            </div>
        </div>
    )
}
