import { useState, useMemo } from 'react'
import { Database, Copy, Download, Plus, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'

interface Column {
    id: string
    name: string
    dataType: string
    length?: string
    precision?: string
    scale?: string
    nullable: boolean
    isPrimaryKey: boolean
    isIdentity: boolean
}

const commonDataTypes = [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL',
    'VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR',
    'DATE', 'DATETIME2', 'TIME', 'DATETIMEOFFSET',
    'BIT', 'UNIQUEIDENTIFIER',
    'BINARY', 'VARBINARY'
]

export default function SynapseDdlHelper() {
    const [tableName, setTableName] = useState('dbo.MyTable')
    const [distribution, setDistribution] = useState<'HASH' | 'ROUND_ROBIN' | 'REPLICATE'>('ROUND_ROBIN')
    const [hashColumn, setHashColumn] = useState('')
    const [indexType, setIndexType] = useState<'CLUSTERED COLUMNSTORE' | 'HEAP' | 'CLUSTERED'>('CLUSTERED COLUMNSTORE')
    const [partitionColumn, setPartitionColumn] = useState('')
    const [partitionFunction, setPartitionFunction] = useState('')
    const [tableType, setTableType] = useState<'TABLE' | 'EXTERNAL' | 'CTAS'>('TABLE')
    const [ctasSource, setCtasSource] = useState('')
    const [externalLocation, setExternalLocation] = useState('')
    const [externalFormat, setExternalFormat] = useState('PARQUET')

    const [columns, setColumns] = useState<Column[]>([
        { id: '1', name: 'Id', dataType: 'INT', nullable: false, isPrimaryKey: true, isIdentity: true },
        { id: '2', name: 'Name', dataType: 'NVARCHAR', length: '100', nullable: false, isPrimaryKey: false, isIdentity: false },
        { id: '3', name: 'CreatedDate', dataType: 'DATETIME2', nullable: false, isPrimaryKey: false, isIdentity: false }
    ])

    const addColumn = () => {
        setColumns([...columns, {
            id: Date.now().toString(),
            name: 'NewColumn',
            dataType: 'VARCHAR',
            length: '50',
            nullable: true,
            isPrimaryKey: false,
            isIdentity: false
        }])
    }

    const updateColumn = (id: string, field: keyof Column, value: any) => {
        setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    const removeColumn = (id: string) => {
        setColumns(columns.filter(c => c.id !== id))
    }

    const addAuditColumns = () => {
        const auditCols: Column[] = [
            { id: `audit_${Date.now()}_1`, name: 'CreatedBy', dataType: 'NVARCHAR', length: '100', nullable: false, isPrimaryKey: false, isIdentity: false },
            { id: `audit_${Date.now()}_2`, name: 'CreatedDate', dataType: 'DATETIME2', nullable: false, isPrimaryKey: false, isIdentity: false },
            { id: `audit_${Date.now()}_3`, name: 'ModifiedBy', dataType: 'NVARCHAR', length: '100', nullable: true, isPrimaryKey: false, isIdentity: false },
            { id: `audit_${Date.now()}_4`, name: 'ModifiedDate', dataType: 'DATETIME2', nullable: true, isPrimaryKey: false, isIdentity: false }
        ]
        setColumns([...columns, ...auditCols])
    }

    const generatedDdl = useMemo(() => {
        if (tableType === 'CTAS') {
            // CTAS Statement
            let sql = `CREATE TABLE ${tableName}\n`
            sql += `WITH\n(\n`
            sql += `    DISTRIBUTION = ${distribution}`
            if (distribution === 'HASH' && hashColumn) {
                sql += `(${hashColumn})`
            }
            sql += `,\n`

            if (indexType === 'CLUSTERED COLUMNSTORE') {
                sql += `    CLUSTERED COLUMNSTORE INDEX`
            } else if (indexType === 'HEAP') {
                sql += `    HEAP`
            }

            sql += `\n)\n`
            sql += `AS\n${ctasSource || 'SELECT * FROM source_table'};`
            return sql
        }

        if (tableType === 'EXTERNAL') {
            // External Table
            let sql = `-- First, create external data source and file format if not exists\n`
            sql += `-- CREATE EXTERNAL DATA SOURCE MyDataSource WITH (TYPE = HADOOP, LOCATION = '${externalLocation || 'abfss://container@account.dfs.core.windows.net/path'}');\n`
            sql += `-- CREATE EXTERNAL FILE FORMAT MyFileFormat WITH (FORMAT_TYPE = ${externalFormat});\n\n`

            sql += `CREATE EXTERNAL TABLE ${tableName}\n(\n`

            columns.forEach((col, idx) => {
                let colDef = `    ${col.name} ${col.dataType}`

                if (col.dataType === 'VARCHAR' || col.dataType === 'NVARCHAR') {
                    colDef += `(${col.length || '50'})`
                } else if (col.dataType === 'CHAR' || col.dataType === 'NCHAR') {
                    colDef += `(${col.length || '10'})`
                } else if (col.dataType === 'DECIMAL' || col.dataType === 'NUMERIC') {
                    colDef += `(${col.precision || '18'},${col.scale || '0'})`
                } else if (col.dataType === 'BINARY' || col.dataType === 'VARBINARY') {
                    colDef += `(${col.length || '50'})`
                }

                colDef += col.nullable ? ' NULL' : ' NOT NULL'

                if (idx < columns.length - 1) colDef += ','
                sql += colDef + '\n'
            })

            sql += `)\nWITH\n(\n`
            sql += `    LOCATION = '/path/to/files/',\n`
            sql += `    DATA_SOURCE = MyDataSource,\n`
            sql += `    FILE_FORMAT = MyFileFormat\n`
            sql += `);`

            return sql
        }

        // Regular Table
        let sql = `CREATE TABLE ${tableName}\n(\n`

        // Columns
        columns.forEach((col, idx) => {
            let colDef = `    ${col.name} ${col.dataType}`

            // Add length/precision/scale
            if (col.dataType === 'VARCHAR' || col.dataType === 'NVARCHAR') {
                colDef += `(${col.length || '50'})`
            } else if (col.dataType === 'CHAR' || col.dataType === 'NCHAR') {
                colDef += `(${col.length || '10'})`
            } else if (col.dataType === 'DECIMAL' || col.dataType === 'NUMERIC') {
                colDef += `(${col.precision || '18'},${col.scale || '0'})`
            } else if (col.dataType === 'BINARY' || col.dataType === 'VARBINARY') {
                colDef += `(${col.length || '50'})`
            }

            // Identity
            if (col.isIdentity) {
                colDef += ' IDENTITY(1,1)'
            }

            // Nullable
            colDef += col.nullable ? ' NULL' : ' NOT NULL'

            if (idx < columns.length - 1) colDef += ','
            sql += colDef + '\n'
        })

        sql += `)\nWITH\n(\n`

        // Distribution
        sql += `    DISTRIBUTION = ${distribution}`
        if (distribution === 'HASH' && hashColumn) {
            sql += `(${hashColumn})`
        }
        sql += `,\n`

        // Index
        if (indexType === 'CLUSTERED COLUMNSTORE') {
            sql += `    CLUSTERED COLUMNSTORE INDEX`
        } else if (indexType === 'HEAP') {
            sql += `    HEAP`
        } else if (indexType === 'CLUSTERED') {
            const pkCols = columns.filter(c => c.isPrimaryKey).map(c => c.name)
            sql += `    CLUSTERED INDEX (${pkCols.length > 0 ? pkCols.join(', ') : 'Id'})`
        }

        // Partition
        if (partitionColumn && partitionFunction) {
            sql += `,\n    PARTITION (${partitionColumn} RANGE RIGHT FOR VALUES (${partitionFunction}))`
        }

        sql += `\n);`

        return sql
    }, [tableName, columns, distribution, hashColumn, indexType, partitionColumn, partitionFunction, tableType, ctasSource, externalLocation, externalFormat])

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedDdl)
    }

    const handleDownload = () => {
        const blob = new Blob([generatedDdl], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${tableName.replace(/\./g, '_')}_ddl.sql`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 w-full h-full max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Database className="h-6 w-6 text-primary" />
                    Synapse DDL Helper
                </h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy DDL
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                </div>
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
                <ResizablePanel defaultSize={45} minSize={30}>
                    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Table Name</label>
                            <Input
                                value={tableName}
                                onChange={(e) => setTableName(e.target.value)}
                                placeholder="schema.TableName"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Table Type</label>
                            <select
                                value={tableType}
                                onChange={(e) => setTableType(e.target.value as 'TABLE' | 'EXTERNAL' | 'CTAS')}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="TABLE">Regular Table</option>
                                <option value="CTAS">CTAS (Create Table As Select)</option>
                                <option value="EXTERNAL">External Table</option>
                            </select>
                        </div>

                        {tableType === 'CTAS' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Source Query</label>
                                <textarea
                                    value={ctasSource}
                                    onChange={(e) => setCtasSource(e.target.value)}
                                    placeholder="SELECT * FROM source_table WHERE..."
                                    className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                                />
                            </div>
                        )}

                        {tableType === 'EXTERNAL' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">External Location</label>
                                    <Input
                                        value={externalLocation}
                                        onChange={(e) => setExternalLocation(e.target.value)}
                                        placeholder="abfss://container@account.dfs.core.windows.net/path"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">File Format</label>
                                    <select
                                        value={externalFormat}
                                        onChange={(e) => setExternalFormat(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="PARQUET">PARQUET</option>
                                        <option value="DELIMITEDTEXT">DELIMITEDTEXT (CSV)</option>
                                        <option value="RCFILE">RCFILE</option>
                                        <option value="ORC">ORC</option>
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Distribution</label>
                                <select
                                    value={distribution}
                                    onChange={(e) => setDistribution(e.target.value as any)}
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                                    <option value="HASH">HASH</option>
                                    <option value="REPLICATE">REPLICATE</option>
                                </select>
                            </div>
                            {distribution === 'HASH' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Hash Column</label>
                                    <Input
                                        value={hashColumn}
                                        onChange={(e) => setHashColumn(e.target.value)}
                                        placeholder="ColumnName"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Index Type</label>
                            <select
                                value={indexType}
                                onChange={(e) => setIndexType(e.target.value as any)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="CLUSTERED COLUMNSTORE">Clustered Columnstore Index (CCI)</option>
                                <option value="HEAP">Heap</option>
                                <option value="CLUSTERED">Clustered Index</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Partition Column (Optional)</label>
                                <Input
                                    value={partitionColumn}
                                    onChange={(e) => setPartitionColumn(e.target.value)}
                                    placeholder="DateColumn"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Partition Values</label>
                                <Input
                                    value={partitionFunction}
                                    onChange={(e) => setPartitionFunction(e.target.value)}
                                    placeholder="'2023-01-01', '2024-01-01'"
                                />
                            </div>
                        </div>

                        {tableType === 'TABLE' && (
                            <div className="space-y-2 border-t pt-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Columns</label>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={addAuditColumns}>
                                            Add Audit Columns
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={addColumn}>
                                            <Plus className="h-3 w-3 mr-1" />
                                            Add Column
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {columns.map((col) => (
                                        <div key={col.id} className="border rounded p-3 space-y-2 bg-muted/20">
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    value={col.name}
                                                    onChange={(e) => updateColumn(col.id, 'name', e.target.value)}
                                                    placeholder="ColumnName"
                                                    className="flex-1"
                                                />
                                                <select
                                                    value={col.dataType}
                                                    onChange={(e) => updateColumn(col.id, 'dataType', e.target.value)}
                                                    className="h-9 w-40 rounded-md border border-input bg-background px-2 text-sm"
                                                >
                                                    {commonDataTypes.map((dt) => (
                                                        <option key={dt} value={dt}>{dt}</option>
                                                    ))}
                                                </select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeColumn(col.id)}
                                                    className="h-9 w-9"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {(col.dataType.includes('VAR') || col.dataType.includes('CHAR') || col.dataType.includes('BINARY')) && (
                                                <Input
                                                    value={col.length || ''}
                                                    onChange={(e) => updateColumn(col.id, 'length', e.target.value)}
                                                    placeholder="Length (e.g., 100 or MAX)"
                                                    className="text-sm"
                                                />
                                            )}

                                            {(col.dataType === 'DECIMAL' || col.dataType === 'NUMERIC') && (
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={col.precision || ''}
                                                        onChange={(e) => updateColumn(col.id, 'precision', e.target.value)}
                                                        placeholder="Precision (18)"
                                                        className="text-sm"
                                                    />
                                                    <Input
                                                        value={col.scale || ''}
                                                        onChange={(e) => updateColumn(col.id, 'scale', e.target.value)}
                                                        placeholder="Scale (0)"
                                                        className="text-sm"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex gap-4 text-sm">
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={col.nullable}
                                                        onChange={(e) => updateColumn(col.id, 'nullable', e.target.checked)}
                                                        className="rounded"
                                                    />
                                                    Nullable
                                                </label>
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={col.isPrimaryKey}
                                                        onChange={(e) => updateColumn(col.id, 'isPrimaryKey', e.target.checked)}
                                                        className="rounded"
                                                    />
                                                    PK
                                                </label>
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={col.isIdentity}
                                                        onChange={(e) => updateColumn(col.id, 'isIdentity', e.target.checked)}
                                                        className="rounded"
                                                    />
                                                    Identity
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={55} minSize={30}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                                Generated Synapse DDL
                            </span>
                        </div>
                        <div className="flex-1 relative">
                            <CodeEditor value={generatedDdl} language="sql" readOnly={true} hideHeader={true} />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                <strong>Recommendations:</strong> Use HASH distribution for large fact tables (choose high-cardinality column).
                Use REPLICATE for small dimension tables (&lt;2GB). Use Clustered Columnstore for analytics workloads.
            </div>
        </div>
    )
}
