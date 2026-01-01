import { useState } from 'react'
import { ArrowRightLeft, Copy, Download, Search } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

interface TypeMapping {
    [key: string]: string
}

interface PlatformMappings {
    [key: string]: TypeMapping
}

// Comprehensive type mappings
const typeMappings: PlatformMappings = {
    // SQL Server to Synapse
    'sqlserver-synapse': {
        'VARCHAR': 'VARCHAR',
        'NVARCHAR': 'NVARCHAR',
        'CHAR': 'CHAR',
        'NCHAR': 'NCHAR',
        'TEXT': 'VARCHAR(MAX)',
        'NTEXT': 'NVARCHAR(MAX)',
        'INT': 'INT',
        'BIGINT': 'BIGINT',
        'SMALLINT': 'SMALLINT',
        'TINYINT': 'TINYINT',
        'BIT': 'BIT',
        'DECIMAL': 'DECIMAL',
        'NUMERIC': 'NUMERIC',
        'FLOAT': 'FLOAT',
        'REAL': 'REAL',
        'MONEY': 'DECIMAL(19,4)',
        'SMALLMONEY': 'DECIMAL(10,4)',
        'DATE': 'DATE',
        'DATETIME': 'DATETIME2',
        'DATETIME2': 'DATETIME2',
        'SMALLDATETIME': 'DATETIME2',
        'TIME': 'TIME',
        'DATETIMEOFFSET': 'DATETIMEOFFSET',
        'UNIQUEIDENTIFIER': 'UNIQUEIDENTIFIER',
        'BINARY': 'BINARY',
        'VARBINARY': 'VARBINARY',
        'IMAGE': 'VARBINARY(MAX)',
        'XML': 'NVARCHAR(MAX)',
        'GEOGRAPHY': 'NVARCHAR(MAX)',
        'GEOMETRY': 'NVARCHAR(MAX)'
    },
    // Synapse to Spark
    'synapse-spark': {
        'VARCHAR': 'StringType',
        'NVARCHAR': 'StringType',
        'CHAR': 'StringType',
        'NCHAR': 'StringType',
        'INT': 'IntegerType',
        'BIGINT': 'LongType',
        'SMALLINT': 'ShortType',
        'TINYINT': 'ByteType',
        'BIT': 'BooleanType',
        'DECIMAL': 'DecimalType',
        'NUMERIC': 'DecimalType',
        'FLOAT': 'DoubleType',
        'REAL': 'FloatType',
        'DATE': 'DateType',
        'DATETIME2': 'TimestampType',
        'TIME': 'StringType',
        'DATETIMEOFFSET': 'TimestampType',
        'UNIQUEIDENTIFIER': 'StringType',
        'BINARY': 'BinaryType',
        'VARBINARY': 'BinaryType'
    },
    // SQL Server to Spark
    'sqlserver-spark': {
        'VARCHAR': 'StringType',
        'NVARCHAR': 'StringType',
        'CHAR': 'StringType',
        'NCHAR': 'StringType',
        'TEXT': 'StringType',
        'NTEXT': 'StringType',
        'INT': 'IntegerType',
        'BIGINT': 'LongType',
        'SMALLINT': 'ShortType',
        'TINYINT': 'ByteType',
        'BIT': 'BooleanType',
        'DECIMAL': 'DecimalType',
        'NUMERIC': 'DecimalType',
        'FLOAT': 'DoubleType',
        'REAL': 'FloatType',
        'MONEY': 'DecimalType',
        'SMALLMONEY': 'DecimalType',
        'DATE': 'DateType',
        'DATETIME': 'TimestampType',
        'DATETIME2': 'TimestampType',
        'SMALLDATETIME': 'TimestampType',
        'TIME': 'StringType',
        'DATETIMEOFFSET': 'TimestampType',
        'UNIQUEIDENTIFIER': 'StringType',
        'BINARY': 'BinaryType',
        'VARBINARY': 'BinaryType',
        'IMAGE': 'BinaryType',
        'XML': 'StringType'
    },
    // SQL to Parquet
    'sql-parquet': {
        'VARCHAR': 'BYTE_ARRAY (UTF8)',
        'NVARCHAR': 'BYTE_ARRAY (UTF8)',
        'CHAR': 'BYTE_ARRAY (UTF8)',
        'NCHAR': 'BYTE_ARRAY (UTF8)',
        'TEXT': 'BYTE_ARRAY (UTF8)',
        'NTEXT': 'BYTE_ARRAY (UTF8)',
        'INT': 'INT32',
        'BIGINT': 'INT64',
        'SMALLINT': 'INT32',
        'TINYINT': 'INT32',
        'BIT': 'BOOLEAN',
        'DECIMAL': 'DECIMAL',
        'NUMERIC': 'DECIMAL',
        'FLOAT': 'DOUBLE',
        'REAL': 'FLOAT',
        'MONEY': 'DECIMAL',
        'SMALLMONEY': 'DECIMAL',
        'DATE': 'INT32 (DATE)',
        'DATETIME': 'INT64 (TIMESTAMP_MILLIS)',
        'DATETIME2': 'INT64 (TIMESTAMP_MILLIS)',
        'SMALLDATETIME': 'INT64 (TIMESTAMP_MILLIS)',
        'TIME': 'INT64 (TIME_MILLIS)',
        'DATETIMEOFFSET': 'INT64 (TIMESTAMP_MILLIS)',
        'UNIQUEIDENTIFIER': 'BYTE_ARRAY (UTF8)',
        'BINARY': 'BYTE_ARRAY',
        'VARBINARY': 'BYTE_ARRAY',
        'IMAGE': 'BYTE_ARRAY'
    },
    // Synapse to PostgreSQL
    'synapse-postgresql': {
        'VARCHAR': 'VARCHAR',
        'NVARCHAR': 'VARCHAR',
        'CHAR': 'CHAR',
        'NCHAR': 'CHAR',
        'INT': 'INTEGER',
        'BIGINT': 'BIGINT',
        'SMALLINT': 'SMALLINT',
        'TINYINT': 'SMALLINT',
        'BIT': 'BOOLEAN',
        'DECIMAL': 'DECIMAL',
        'NUMERIC': 'NUMERIC',
        'FLOAT': 'DOUBLE PRECISION',
        'REAL': 'REAL',
        'DATE': 'DATE',
        'DATETIME2': 'TIMESTAMP',
        'TIME': 'TIME',
        'DATETIMEOFFSET': 'TIMESTAMP WITH TIME ZONE',
        'UNIQUEIDENTIFIER': 'UUID',
        'BINARY': 'BYTEA',
        'VARBINARY': 'BYTEA'
    }
}

const platforms = [
    { value: 'sqlserver-synapse', label: 'SQL Server → Synapse' },
    { value: 'synapse-spark', label: 'Synapse → Spark' },
    { value: 'sqlserver-spark', label: 'SQL Server → Spark' },
    { value: 'sql-parquet', label: 'SQL → Parquet Schema' },
    { value: 'synapse-postgresql', label: 'Synapse → PostgreSQL' }
]

export default function DataTypeMapper() {
    const [selectedMapping, setSelectedMapping] = useState('sqlserver-synapse')
    const [searchTerm, setSearchTerm] = useState('')
    const [reverseMapping, setReverseMapping] = useState(false)

    const currentMappings = typeMappings[selectedMapping] || {}

    // Get reverse mapping if needed
    const displayMappings = reverseMapping
        ? Object.entries(currentMappings).reduce((acc, [key, value]) => {
            // Group by target value
            if (!acc[value]) acc[value] = []
            acc[value].push(key)
            return acc
        }, {} as { [key: string]: string[] })
        : currentMappings

    // Filter by search term
    const filteredMappings = Object.entries(displayMappings).filter(([source]) =>
        source.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCopyAll = () => {
        const text = filteredMappings
            .map(([source, target]) => {
                if (Array.isArray(target)) {
                    return `${source} ← ${target.join(', ')}`
                }
                return `${source} → ${target}`
            })
            .join('\n')
        navigator.clipboard.writeText(text)
    }

    const handleDownload = () => {
        const text = filteredMappings
            .map(([source, target]) => {
                if (Array.isArray(target)) {
                    return `${source},${target.join(';')}`
                }
                return `${source},${target}`
            })
            .join('\n')
        const blob = new Blob([`Source Type,Target Type(s)\n${text}`], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `type_mapping_${selectedMapping}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleCopyRow = (source: string, target: string | string[]) => {
        const text = Array.isArray(target)
            ? `${source} ← ${target.join(', ')}`
            : `${source} → ${target}`
        navigator.clipboard.writeText(text)
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 w-full h-full max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ArrowRightLeft className="h-6 w-6 text-primary" />
                    Data Type Mapper
                </h1>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyAll}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Download CSV
                    </Button>
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Conversion Direction</label>
                    <select
                        value={selectedMapping}
                        onChange={(e) => setSelectedMapping(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                        {platforms.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Search Types</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search data types..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                <div className="pt-6">
                    <Button
                        variant={reverseMapping ? "default" : "outline"}
                        onClick={() => setReverseMapping(!reverseMapping)}
                        title="Show reverse mapping (target → sources)"
                    >
                        <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 border rounded-lg overflow-hidden">
                <div className="h-full overflow-y-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0 z-10">
                            <tr>
                                <th className="text-left p-3 font-semibold text-sm">
                                    {reverseMapping ? 'Target Type' : 'Source Type'}
                                </th>
                                <th className="text-left p-3 font-semibold text-sm">
                                    {reverseMapping ? 'Possible Sources' : 'Target Type'}
                                </th>
                                <th className="w-16 p-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMappings.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="text-center p-8 text-muted-foreground">
                                        No matching types found
                                    </td>
                                </tr>
                            ) : (
                                filteredMappings.map(([source, target]) => (
                                    <tr key={source} className="border-t hover:bg-muted/20 transition-colors">
                                        <td className="p-3 font-mono text-sm font-semibold">{source}</td>
                                        <td className="p-3 font-mono text-sm text-primary">
                                            {Array.isArray(target) ? target.join(', ') : target}
                                        </td>
                                        <td className="p-3">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleCopyRow(source, target)}
                                                title="Copy this mapping"
                                                className="h-8 w-8"
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                <strong>Note:</strong> Type mappings are approximations. Always verify data type compatibility
                and precision/scale requirements for your specific use case. For sized types (VARCHAR, DECIMAL),
                ensure length/precision parameters are appropriate for the target platform.
            </div>
        </div>
    )
}
