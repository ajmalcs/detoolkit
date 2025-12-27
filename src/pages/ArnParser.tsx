import { useState } from 'react'
import { RotateCcw, Copy } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { CodeEditor } from '../components/ui/code-editor'

interface ArnParts {
    partition: string
    service: string
    region: string
    account: string
    resource: string
}

export default function ArnParser() {
    const [input, setInput] = useState('')
    const [error, setError] = useState('')
    const [parts, setParts] = useState<ArnParts | null>(null)

    const parseArn = (arn: string) => {
        setInput(arn)
        setError('')
        setParts(null)

        if (!arn.trim()) return

        // Basic ARN check
        if (!arn.startsWith('arn:')) {
            setError('Invalid ARN: Must start with "arn:"')
            return
        }

        const segments = arn.split(':')
        if (segments.length < 6) {
            setError('Invalid ARN: Not enough segments (min 6)')
            return
        }

        // arn:partition:service:region:account:resource
        // Resource can contain colons, so we slice correctly.
        const [_, partition, service, region, account, ...resourceParts] = segments
        const resource = resourceParts.join(':')

        setParts({
            partition,
            service,
            region,
            account,
            resource
        })
    }

    const handleClear = () => {
        setInput('')
        setParts(null)
        setError('')
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-2xl mx-auto w-full h-full">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">AWS ARN Parser</h1>
                <Button variant="outline" size="sm" onClick={handleClear}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                </Button>
            </div>

            <Card className="p-4 flex flex-col gap-4">
                <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Input ARN</label>
                    <div className="h-24 border rounded-md overflow-hidden">
                        <CodeEditor
                            value={input}
                            onChange={(val) => parseArn(val || '')}
                            language="text"
                            minimap={false}
                        />
                    </div>
                </div>

                {error && (
                    <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md border border-destructive/20">
                        {error}
                    </div>
                )}

                {parts && (
                    <div className="grid grid-cols-1 gap-0 border rounded-md divide-y overflow-hidden">
                        <ArnRow label="Partition" value={parts.partition} color="text-yellow-500" />
                        <ArnRow label="Service" value={parts.service} color="text-blue-500" />
                        <ArnRow label="Region" value={parts.region} color="text-green-500" />
                        <ArnRow label="Account ID" value={parts.account} color="text-purple-500" />
                        <ArnRow label="Resource" value={parts.resource} color="text-foreground" />
                    </div>
                )}
            </Card>
        </div>
    )
}

function ArnRow({ label, value, color }: { label: string, value: string, color: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(value)
    }

    return (
        <div className={`flex items-center p-3 bg-muted/20 hover:bg-muted/40 transition-colors group`}>
            <div className="w-32 text-sm font-medium text-muted-foreground">{label}</div>
            <div className={`flex-1 font-mono text-sm truncate ${color} font-medium`}>
                {value || <span className="text-muted-foreground/30 italic">High-level / Global</span>}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={handleCopy}>
                <Copy className="h-3 w-3" />
            </Button>
        </div>
    )
}
