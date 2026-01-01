import { useState, useMemo } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs' // Assuming these exist, check later if not I'll use standard divs
import { Trash2, Wand2, Download, Minimize2, Maximize2 } from 'lucide-react'
import Papa from 'papaparse'

// Dialect mappings for types
const dialectTypes: any = {
    postgresql: { text: 'TEXT', number: 'INTEGER', float: 'DECIMAL', boolean: 'BOOLEAN', date: 'TIMESTAMP' },
    bigquery: { text: 'STRING', number: 'INT64', float: 'FLOAT64', boolean: 'BOOL', date: 'TIMESTAMP' },
    snowflake: { text: 'VARCHAR', number: 'NUMBER', float: 'FLOAT', boolean: 'BOOLEAN', date: 'TIMESTAMP_NTZ' },
    mysql: { text: 'VARCHAR(255)', number: 'INT', float: 'DECIMAL', boolean: 'BOOLEAN', date: 'DATETIME' },
    synapse: { text: 'NVARCHAR(4000)', number: 'INT', float: 'FLOAT', boolean: 'BIT', date: 'DATETIME2' },
    mssql: { text: 'VARCHAR(100)', number: 'INT', float: 'DECIMAL', boolean: 'BIT', date: 'DATETIME' }
}

const commonTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number (Int)' },
    { value: 'float', label: 'Number (Float)' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'date', label: 'Date/Time' }
]

export default function DdlDesigner() {
    const [dialect, setDialect] = useState('mssql')
    const [tableName, setTableName] = useState('my_table')

    // Advanced Table Properties
    const [synapseDistribution, setSynapseDistribution] = useState('ROUND_ROBIN')
    const [synapseDistCol, setSynapseDistCol] = useState('')
    const [synapseIndex, setSynapseIndex] = useState('CCI') // Clustered Columnstore Index
    const [synapseCCIOrdered, setSynapseCCIOrdered] = useState(false)
    const [synapseCCIOrderCol, setSynapseCCIOrderCol] = useState('')

    // Updated Column State
    const [columns, setColumns] = useState<{ id: number, name: string, type: string, nullable: boolean, pk: boolean, identity: boolean, default?: string }[]>([
        { id: 1, name: 'id', type: 'number', nullable: false, pk: true, identity: true }
    ])

    const [activeTab, setActiveTab] = useState('visual')
    const [csvInput, setCsvInput] = useState('')

    const addColumn = () => {
        setColumns([...columns, { id: Date.now(), name: '', type: 'text', nullable: true, pk: false, identity: false }])
    }

    const updateColumn = (id: number, field: string, value: any) => {
        setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    const removeColumn = (id: number) => {
        setColumns(columns.filter(c => c.id !== id))
    }

    const addAuditColumns = () => {
        const newCols = [
            { id: Date.now() + 1, name: 'created_at', type: 'date', nullable: false, pk: false, identity: false, default: 'CURRENT_TIMESTAMP' },
            { id: Date.now() + 2, name: 'updated_at', type: 'date', nullable: false, pk: false, identity: false },
            { id: Date.now() + 3, name: 'batch_id', type: 'text', nullable: true, pk: false, identity: false }
        ]
        setColumns([...columns, ...newCols])
    }

    const previewDdl = useMemo(() => {
        const typeMap = dialectTypes[dialect]
        const colDefs = columns.map(c => {
            let def = `    ${c.name || 'unnamed'} ${typeMap[c.type] || c.type.toUpperCase()}`

            // Auto Increment / Identity
            if (c.identity) {
                if (dialect === 'postgresql') def += ' GENERATED ALWAYS AS IDENTITY'
                else if (dialect === 'mysql') def += ' AUTO_INCREMENT'
                else if (dialect === 'synapse' || dialect === 'mssql') def += ' IDENTITY(1,1)'
                // Snowflake/BigQuery don't strictly use IDENTITY keyword in standard create table usually, mostly Snowflake uses 'autoincrement'
                else if (dialect === 'snowflake') def += ' AUTOINCREMENT'
            }

            // Synapse constraints are limited, PKs are NOT ENFORCED
            if (c.pk && dialect !== 'synapse') def += ' PRIMARY KEY'
            else if (c.pk && dialect === 'synapse') def += ' NOT NULL'
            else if (!c.nullable) def += ' NOT NULL'

            // Default
            if (c.default) {
                def += ` DEFAULT ${c.default}`
            }

            return def
        })

        let suffix = ');'

        if (dialect === 'synapse') {
            let dist = 'ROUND_ROBIN'
            if (synapseDistribution === 'HASH') dist = `HASH([${synapseDistCol || columns[0].name}])`
            else if (synapseDistribution === 'REPLICATE') dist = 'REPLICATE'

            let idx = 'CLUSTERED COLUMNSTORE INDEX'
            if (synapseIndex === 'HEAP') idx = 'HEAP'
            else if (synapseIndex === 'CLUSTERED') idx = `CLUSTERED INDEX([${columns.find(c => c.pk)?.name || columns[0].name}])`
            else if (synapseIndex === 'CCI' && synapseCCIOrdered) {
                idx = `CLUSTERED COLUMNSTORE INDEX ORDER([${synapseCCIOrderCol || columns[0].name}])`
            }

            suffix = `)\nWITH\n(\n    DISTRIBUTION = ${dist},\n    ${idx}\n);`
        }

        return `CREATE TABLE ${tableName} (\n${colDefs.join(',\n')}\n${suffix}`
    }, [columns, dialect, tableName, synapseDistribution, synapseDistCol, synapseIndex, synapseCCIOrdered, synapseCCIOrderCol])

    const inferFromCsv = () => {
        if (!csvInput.trim()) return

        Papa.parse(csvInput.trim(), {
            header: true,
            skipEmptyLines: true,
            preview: 50, // Scan first 50 rows
            complete: (results) => {
                const headers = results.meta.fields || []
                const data = results.data as any[]
                const now = Date.now()

                const inferredCols = headers.map((header, idx) => {
                    let type = 'text'

                    // Simple type checking based on first non-null value found
                    const sampleValues = data.map(row => row[header]).filter(v => v !== null && v !== undefined && v !== '')

                    if (sampleValues.length > 0) {
                        const isAllNumbers = sampleValues.every(v => !isNaN(Number(v)) && v.trim() !== '')
                        const isAllBooleans = sampleValues.every(v => v.toLowerCase() === 'true' || v.toLowerCase() === 'false')
                        // Basic date check - can be improved
                        const isAllDates = sampleValues.every(v => !isNaN(Date.parse(v)) && isNaN(Number(v)))

                        if (isAllBooleans) type = 'boolean'
                        else if (isAllNumbers) {
                            // Check for floats
                            const isFloat = sampleValues.some(v => v.includes('.'))
                            type = isFloat ? 'float' : 'number'
                        }
                        else if (isAllDates) type = 'date'
                    }

                    return {
                        id: now + idx,
                        name: header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
                        type,
                        nullable: true,
                        pk: false,
                        identity: false
                    }
                })

                if (inferredCols.length > 0) {
                    setColumns(inferredCols)
                    setActiveTab('visual') // Switch to visual builder to show results
                }
            }
        })
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result as string
            setCsvInput(content)
        }
        reader.readAsText(file)
    }

    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        if (!previewDdl) return
        const blob = new Blob([previewDdl], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${tableName}.sql`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Wand2 className="h-6 w-6 text-primary" />
                    Smart DDL Designer
                </h1>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 border px-3 py-1 rounded-md bg-background">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Table Name:</span>
                        <input
                            value={tableName}
                            onChange={e => setTableName(e.target.value)}
                            className="h-8 text-sm outline-none bg-transparent w-32"
                        />
                    </div>
                    <select
                        value={dialect}
                        onChange={e => setDialect(e.target.value)}
                        className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                    >
                        <option value="postgresql">PostgreSQL</option>
                        <option value="bigquery">BigQuery</option>
                        <option value="snowflake">Snowflake</option>
                        <option value="mysql">MySQL</option>
                        <option value="mssql">SQL Server (T-SQL)</option>
                        <option value="synapse">Synapse (Dedicated Pool)</option>
                    </select>
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsList>
                    <TabsTrigger value="visual">Visual Builder</TabsTrigger>
                    <TabsTrigger value="csv">Infer from CSV</TabsTrigger>
                </TabsList>

                <TabsContent value="visual" className="flex-1 flex flex-col min-h-0 mt-4 data-[state=inactive]:hidden">
                    <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
                        <ResizablePanel defaultSize={60} minSize={30}>
                            {/* Columns List */}
                            <div className="flex flex-col h-full gap-2 p-4 bg-background overflow-hidden">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium text-sm">Columns</h3>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={addAuditColumns}>+ Audit Cols</Button>
                                        <Button size="sm" onClick={addColumn}>+ Add Column</Button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto flex flex-col gap-2">
                                    {columns.map((col) => (
                                        <div key={col.id} className="flex items-center gap-2 p-2 border rounded hover:bg-muted/50">
                                            <Input
                                                className="h-8 w-40"
                                                value={col.name}
                                                onChange={e => updateColumn(col.id, 'name', e.target.value)}
                                                placeholder="Column Name"
                                            />
                                            <select
                                                className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm"
                                                value={col.type}
                                                onChange={e => updateColumn(col.id, 'type', e.target.value)}
                                            >
                                                {commonTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                            <div className="flex items-center gap-3 text-sm ml-2">
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input type="checkbox" checked={col.pk} onChange={e => updateColumn(col.id, 'pk', e.target.checked)} />
                                                    PK
                                                </label>
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input type="checkbox" checked={col.nullable} onChange={e => updateColumn(col.id, 'nullable', e.target.checked)} disabled={col.pk} />
                                                    Null
                                                </label>
                                                {(col.type === 'number' || col.type === 'float') && (
                                                    <label className="flex items-center gap-1 cursor-pointer" title="Auto Increment / Identity">
                                                        <input type="checkbox" checked={col.identity} onChange={e => updateColumn(col.id, 'identity', e.target.checked)} />
                                                        Auto Inc
                                                    </label>
                                                )}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-destructive hover:text-destructive" onClick={() => removeColumn(col.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        <ResizablePanel defaultSize={40} minSize={20}>
                            {/* Preview & Advanced Settings */}
                            <div className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
                                {dialect === 'synapse' && (
                                    <div className="border rounded-md p-4 bg-background flex flex-col gap-3">
                                        <h3 className="font-medium text-sm flex items-center gap-2">
                                            🏛️ Synapse Properties
                                        </h3>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Distribution</label>
                                            <select
                                                className="w-full h-8 rounded-md border border-input bg-background text-sm px-2"
                                                value={synapseDistribution}
                                                onChange={e => setSynapseDistribution(e.target.value)}
                                            >
                                                <option value="ROUND_ROBIN">ROUND_ROBIN (Default)</option>
                                                <option value="HASH">HASH Distributed</option>
                                                <option value="REPLICATE">REPLICATE (Small Tables)</option>
                                            </select>
                                        </div>
                                        {synapseDistribution === 'HASH' && (
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Distribution Column</label>
                                                <select
                                                    className="w-full h-8 rounded-md border border-input bg-background text-sm px-2"
                                                    value={synapseDistCol}
                                                    onChange={e => setSynapseDistCol(e.target.value)}
                                                >
                                                    {columns.map(c => (
                                                        <option key={c.id} value={c.name}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Indexing</label>
                                            <select
                                                className="w-full h-8 rounded-md border border-input bg-background text-sm px-2"
                                                value={synapseIndex}
                                                onChange={e => setSynapseIndex(e.target.value)}
                                            >
                                                <option value="CCI">Clustered Columnstore (Default)</option>
                                                <option value="HEAP">Heap</option>
                                                <option value="CLUSTERED">Clustered Index</option>
                                            </select>
                                        </div>
                                        {synapseIndex === 'CCI' && (
                                            <div className="space-y-1 pl-2 border-l-2">
                                                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={synapseCCIOrdered}
                                                        onChange={e => setSynapseCCIOrdered(e.target.checked)}
                                                    />
                                                    Optimize (Ordered CCI)
                                                </label>
                                                {synapseCCIOrdered && (
                                                    <select
                                                        className="w-full h-8 rounded-md border border-input bg-background text-sm px-2 mt-1"
                                                        value={synapseCCIOrderCol}
                                                        onChange={e => setSynapseCCIOrderCol(e.target.value)}
                                                    >
                                                        {columns.map(c => (
                                                            <option key={c.id} value={c.name}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex-1 min-h-0 border rounded-md overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                                        <span className="text-xs font-medium text-muted-foreground uppercase">Live DDL Preview</span>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDownload} title="Download SQL">
                                            <Download className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="flex-1 relative">
                                        <CodeEditor
                                            value={previewDdl || '-- Add columns to see DDL'}
                                            language="sql"
                                            readOnly={true}
                                        />
                                    </div>
                                </div>
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </TabsContent>

                <TabsContent value="csv" className="flex-1 flex gap-4 min-h-0 mt-4 data-[state=inactive]:hidden">
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm">Paste CSV Data or Upload</h3>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setCsvInput('')} disabled={!csvInput}>
                                    Clear
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => document.getElementById('csv-upload')?.click()}>
                                    Upload File
                                </Button>
                                <input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                        <Textarea
                            className="flex-1 font-mono text-sm resize-none"
                            placeholder="id,name,age&#10;1,John,30&#10;2,Jane,25"
                            value={csvInput}
                            onChange={e => setCsvInput(e.target.value)}
                        />
                        <Button onClick={inferFromCsv} disabled={!csvInput}>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Infer Schema
                        </Button>
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                        <h3 className="font-medium text-sm">Generated DDL</h3>
                        <div className="flex-1 border rounded-md overflow-hidden">
                            <CodeEditor value={previewDdl} language="sql" readOnly />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
