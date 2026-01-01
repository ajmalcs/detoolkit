import { useState, useEffect } from 'react'
import { Copy, Minimize2, Maximize2, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { CodeEditor } from '../components/ui/code-editor'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../components/ui/resizable'

const PRESETS = [
    { label: 'None', value: '' },
    { label: '@once', value: '@once', desc: 'Run once' },
    { label: '@hourly', value: '@hourly', desc: '0 * * * *' },
    { label: '@daily', value: '@daily', desc: '0 0 * * *' },
    { label: '@weekly', value: '@weekly', desc: '0 0 * * 0' },
    { label: '@monthly', value: '@monthly', desc: '0 0 1 * *' },
    { label: '@yearly', value: '@yearly', desc: '0 0 1 1 *' },
]

export default function AirflowCron() {
    // 0 * * * *
    const [minute, setMinute] = useState('0')
    const [hour, setHour] = useState('*')
    const [dayOfMonth, setDayOfMonth] = useState('*')
    const [month, setMonth] = useState('*')
    const [dayOfWeek, setDayOfWeek] = useState('*')

    const [preset, setPreset] = useState('')
    const [output, setOutput] = useState('0 * * * *')
    const [description, setDescription] = useState('Every hour at minute 0')

    const [dagId, setDagId] = useState('my_dag')
    const [dagCode, setDagCode] = useState('')

    useEffect(() => {
        if (preset) {
            setOutput(preset)
            const p = PRESETS.find(x => x.value === preset)
            setDescription(p?.desc || '')
        } else {
            const cron = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
            setOutput(cron)
            // Basic description logic could go here, or use a library like cronstrue if added
            setDescription('Custom cron schedule')
        }
    }, [minute, hour, dayOfMonth, month, dayOfWeek, preset])

    useEffect(() => {
        const code = `from airflow import DAG
from airflow.operators.empty import EmptyOperator
from datetime import datetime

with DAG(
    dag_id='${dagId}',
    start_date=datetime(2023, 1, 1),
    schedule_interval='${output}',
    catchup=False
) as dag:
    start = EmptyOperator(task_id='start')
    end = EmptyOperator(task_id='end')

    start >> end`
        setDagCode(code)
    }, [dagId, output])

    const handlePresetChange = (val: string) => {
        setPreset(val)
        if (!val) {
            // Reset to default
            setMinute('0')
            setHour('*')
            setDayOfMonth('*')
            setMonth('*')
            setDayOfWeek('*')
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(dagCode)
    }

    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        const text = `# Airflow DAG: ${dagId}\n# Schedule: ${output} (${description})\n\n${dagCode}`
        const blob = new Blob([text], { type: 'text/python' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${dagId}.py`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-4 gap-4 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background' : 'max-w-7xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight">Airflow Cron Generator</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handleDownload} title="Download DAG">
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
                </div>
            </div>

            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-background">
                <ResizablePanelGroup direction="horizontal" className="flex-1 h-full min-h-0 rounded-lg border">
                    <ResizablePanel defaultSize={40} minSize={30}>
                        <Card className="flex flex-col h-full rounded-none border-0 overflow-y-auto">
                            <div className="p-6 space-y-6">

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Airflow Preset</label>
                                    <div className="flex flex-wrap gap-2">
                                        {PRESETS.map(p => (
                                            <Button
                                                key={p.value}
                                                variant={preset === p.value ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handlePresetChange(p.value)}
                                                className="text-xs"
                                            >
                                                {p.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {!preset && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono text-muted-foreground">
                                            <div>MIN</div>
                                            <div>HOUR</div>
                                            <div>DOM</div>
                                            <div>MON</div>
                                            <div>DOW</div>
                                        </div>
                                        <div className="grid grid-cols-5 gap-2">
                                            <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-center" value={minute} onChange={e => setMinute(e.target.value)} />
                                            <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-center" value={hour} onChange={e => setHour(e.target.value)} />
                                            <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-center" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} />
                                            <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-center" value={month} onChange={e => setMonth(e.target.value)} />
                                            <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-center" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} />
                                        </div>
                                        <p className="text-sm text-muted-foreground text-center pt-2">
                                            Result: <span className="font-mono font-bold text-primary bg-muted px-2 py-1 rounded">{output}</span>
                                            {description && <span className="block text-xs mt-1 italic">{description}</span>}
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2 pt-4 border-t">
                                    <label className="text-sm font-medium">DAG ID</label>
                                    <input
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        value={dagId}
                                        onChange={(e) => setDagId(e.target.value)}
                                    />
                                </div>

                            </div>
                        </Card>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={60} minSize={30}>
                        <Card className="flex flex-col h-full rounded-none border-0 relative bg-card">
                            <label className="text-sm font-medium text-muted-foreground absolute top-2 right-16 z-10 bg-background/80 px-2 rounded">Generated DAG Code</label>
                            <div className="flex-1 overflow-hidden relative">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-2 right-2 z-20 text-muted-foreground hover:text-foreground"
                                    onClick={handleCopy}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                                <div className="flex-1 w-full relative min-h-0">
                                    <CodeEditor
                                        value={dagCode}
                                        language="python"
                                        readOnly={true}
                                    />
                                </div>
                            </div>
                        </Card>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
