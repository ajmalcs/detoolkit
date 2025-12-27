import { useState } from 'react'
import { Eraser, Columns, Rows, FileCode, ArrowRightLeft, AlignLeft } from 'lucide-react'
import { format as formatSql } from 'sql-formatter'
import { Button } from '../components/ui/button'
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

export default function DiffChecker() {
    const [original, setOriginal] = useState('')
    const [modified, setModified] = useState('')
    const [language, setLanguage] = useState('text')
    const [sideBySide, setSideBySide] = useState(true)
    const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)

    // Refs to store current values to avoid re-rendering loop issues if we synced strictly on every keystroke
    // But for this simple app, state sync is fine.

    const handleClear = () => {
        setOriginal('')
        setModified('')
    }

    const handleFormat = () => {
        if (language === 'json') {
            try {
                const fmtOriginal = original ? JSON.stringify(JSON.parse(original), null, 2) : ''
                const fmtModified = modified ? JSON.stringify(JSON.parse(modified), null, 2) : ''
                setOriginal(fmtOriginal)
                setModified(fmtModified)
            } catch (e) {
                // Ignore parse errors, user might be typing
                console.error("JSON Parse Error", e)
            }
        } else if (language === 'sql') {
            try {
                const fmtOriginal = original ? formatSql(original, { language: 'sql', keywordCase: 'upper' }) : ''
                const fmtModified = modified ? formatSql(modified, { language: 'sql', keywordCase: 'upper' }) : ''
                setOriginal(fmtOriginal)
                setModified(fmtModified)
            } catch (e) {
                console.error("SQL Format Error", e)
            }
        }
    }

    const handleSwap = () => {
        setOriginal(modified)
        setModified(original)
    }

    const handleEditorDidMount = (editor: any) => {
        const originalModel = editor.getOriginalEditor().getModel();
        const modifiedModel = editor.getModifiedEditor().getModel();

        // Listen to changes in the "Original" (Left) editor
        originalModel.onDidChangeContent(() => {
            setOriginal(originalModel.getValue());
        });

        // Listen to changes in the "Modified" (Right) editor
        modifiedModel.onDidChangeContent(() => {
            setModified(modifiedModel.getValue());
        });
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-7xl mx-auto w-full h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold">Diff Checker</h1>
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        {languages.map((l) => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex mx-2 border rounded-md overflow-hidden">
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
                </div>
            </div>

            <div className="flex-1 border rounded-lg overflow-hidden bg-background relative min-h-0">
                <DiffCodeEditor
                    original={original}
                    modified={modified}
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
