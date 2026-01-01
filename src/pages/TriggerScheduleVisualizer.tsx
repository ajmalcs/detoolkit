import { useState, useMemo, useRef } from 'react'
import { FileJson, Clock, Play, Calendar, AlertCircle, CheckCircle2, Timer, Zap, Info, Upload, BarChart3, AlertTriangle, TrendingUp, Layers } from 'lucide-react'
import { Button } from '../components/ui/button'
import { CodeEditor } from '../components/ui/code-editor'

// Sample trigger data
const SAMPLE_TRIGGERS = {
    "triggers": [
        {
            "name": "DailyMorning_6AM",
            "properties": {
                "type": "ScheduleTrigger",
                "runtimeState": "Started",
                "typeProperties": {
                    "recurrence": {
                        "frequency": "Day",
                        "interval": 1,
                        "startTime": "2024-01-01T06:00:00Z",
                        "timeZone": "UTC"
                    }
                },
                "pipelines": [
                    { "pipelineReference": { "referenceName": "Customer_Orders_Pipeline" } },
                    { "pipelineReference": { "referenceName": "Inventory_Sync_Pipeline" } }
                ]
            }
        },
        {
            "name": "Hourly_Business_Hours",
            "properties": {
                "type": "ScheduleTrigger",
                "runtimeState": "Started",
                "typeProperties": {
                    "recurrence": {
                        "frequency": "Hour",
                        "interval": 1,
                        "startTime": "2024-01-01T09:00:00Z",
                        "endTime": "2024-01-01T17:00:00Z",
                        "timeZone": "Eastern Standard Time"
                    }
                },
                "pipelines": [
                    { "pipelineReference": { "referenceName": "RealTime_Sales_Aggregation" } }
                ]
            }
        },
        {
            "name": "WeeklyFullLoad_Sunday",
            "properties": {
                "type": "ScheduleTrigger",
                "runtimeState": "Stopped",
                "typeProperties": {
                    "recurrence": {
                        "frequency": "Week",
                        "interval": 1,
                        "startTime": "2024-01-07T02:00:00Z",
                        "timeZone": "UTC",
                        "schedule": {
                            "weekDays": ["Sunday"]
                        }
                    }
                },
                "pipelines": [
                    { "pipelineReference": { "referenceName": "Full_Data_Refresh" } }
                ]
            }
        },
        {
            "name": "TumblingWindow_15min",
            "properties": {
                "type": "TumblingWindowTrigger",
                "runtimeState": "Started",
                "typeProperties": {
                    "frequency": "Minute",
                    "interval": 15,
                    "startTime": "2024-01-01T00:00:00Z",
                    "delay": "00:00:00",
                    "maxConcurrency": 1,
                    "retryPolicy": {
                        "count": 3,
                        "intervalInSeconds": 30
                    }
                },
                "pipeline": {
                    "pipelineReference": { "referenceName": "Incremental_CDC_Load" }
                }
            }
        },
        {
            "name": "BlobCreated_Trigger",
            "properties": {
                "type": "BlobEventsTrigger",
                "runtimeState": "Started",
                "typeProperties": {
                    "blobPathBeginsWith": "/raw-data/inbound/",
                    "blobPathEndsWith": ".csv",
                    "events": ["Microsoft.Storage.BlobCreated"]
                },
                "pipelines": [
                    { "pipelineReference": { "referenceName": "Process_Incoming_Files" } }
                ]
            }
        }
    ]
}

// Sample ARM template
const SAMPLE_ARM_TEMPLATE = {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [
        {
            "name": "[concat(parameters('factoryName'), '/DailyETL_Trigger')]",
            "type": "Microsoft.DataFactory/factories/triggers",
            "apiVersion": "2018-06-01",
            "properties": {
                "type": "ScheduleTrigger",
                "runtimeState": "Started",
                "typeProperties": {
                    "recurrence": {
                        "frequency": "Day",
                        "interval": 1,
                        "startTime": "2024-01-01T05:00:00Z",
                        "timeZone": "UTC"
                    }
                },
                "pipelines": [
                    { "pipelineReference": { "referenceName": "Daily_ETL_Pipeline", "type": "PipelineReference" } }
                ]
            }
        },
        {
            "name": "[concat(parameters('factoryName'), '/Hourly_Sync')]",
            "type": "Microsoft.DataFactory/factories/triggers",
            "apiVersion": "2018-06-01",
            "properties": {
                "type": "ScheduleTrigger",
                "runtimeState": "Started",
                "typeProperties": {
                    "recurrence": {
                        "frequency": "Hour",
                        "interval": 2,
                        "startTime": "2024-01-01T00:00:00Z",
                        "timeZone": "UTC"
                    }
                },
                "pipelines": [
                    { "pipelineReference": { "referenceName": "Data_Sync_Pipeline", "type": "PipelineReference" } }
                ]
            }
        }
    ]
}

interface TriggerInfo {
    name: string
    type: string
    state: string
    frequency: string
    interval: number
    startTime: string
    timeZone: string
    pipelines: string[]
    humanReadable: string
    runsPerDay: number
    runsPerWeek: number
    runsPerMonth: number
    startHour: number
}

const parseTriggersFromARM = (json: any): TriggerInfo[] => {
    const triggers: TriggerInfo[] = []
    const resources = json.resources || []

    resources.forEach((resource: any) => {
        if (resource.type === 'Microsoft.DataFactory/factories/triggers') {
            // Extract name from ARM format: "[concat(parameters('factoryName'), '/TriggerName')]"
            let name = resource.name || 'Unnamed'
            const nameMatch = name.match(/'\/?([^']+)'[)\]]?$/)
            if (nameMatch) {
                name = nameMatch[1].replace(/^\//, '')
            }

            const props = resource.properties || {}
            const typeProps = props.typeProperties || {}
            const recurrence = typeProps.recurrence || {}

            let pipelines: string[] = []
            if (props.pipelines) {
                pipelines = props.pipelines.map((p: any) => p.pipelineReference?.referenceName || 'Unknown')
            } else if (props.pipeline) {
                pipelines = [props.pipeline.pipelineReference?.referenceName || 'Unknown']
            }

            const frequency = recurrence.frequency || typeProps.frequency || 'Event'
            const interval = recurrence.interval || typeProps.interval || 1
            const startTime = recurrence.startTime || typeProps.startTime || ''
            const timeZone = recurrence.timeZone || 'UTC'
            const startHour = startTime ? new Date(startTime).getUTCHours() : 0

            const { humanReadable, runsPerDay, runsPerWeek, runsPerMonth } = calculateScheduleMetrics(props.type, frequency, interval, recurrence, startTime)

            triggers.push({
                name,
                type: props.type || 'Unknown',
                state: props.runtimeState || 'Unknown',
                frequency,
                interval,
                startTime,
                timeZone,
                pipelines,
                humanReadable,
                runsPerDay,
                runsPerWeek,
                runsPerMonth,
                startHour
            })
        }
    })

    return triggers
}

const calculateScheduleMetrics = (type: string, frequency: string, interval: number, recurrence: any, startTime: string) => {
    let humanReadable = ''
    let runsPerDay = 0
    let runsPerWeek = 0
    let runsPerMonth = 0

    if (type === 'ScheduleTrigger') {
        if (frequency === 'Day') {
            humanReadable = `Every ${interval > 1 ? interval + ' days' : 'day'} at ${startTime ? new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}`
            runsPerDay = 1 / interval
            runsPerWeek = 7 / interval
            runsPerMonth = 30 / interval
        } else if (frequency === 'Hour') {
            humanReadable = `Every ${interval > 1 ? interval + ' hours' : 'hour'}`
            runsPerDay = 24 / interval
            runsPerWeek = runsPerDay * 7
            runsPerMonth = runsPerDay * 30
        } else if (frequency === 'Week') {
            const days = recurrence.schedule?.weekDays?.join(', ') || 'Sunday'
            const dayCount = recurrence.schedule?.weekDays?.length || 1
            humanReadable = `Every ${interval > 1 ? interval + ' weeks' : 'week'} on ${days}`
            runsPerWeek = dayCount / interval
            runsPerDay = runsPerWeek / 7
            runsPerMonth = runsPerWeek * 4
        } else if (frequency === 'Minute') {
            humanReadable = `Every ${interval} minutes`
            runsPerDay = (24 * 60) / interval
            runsPerWeek = runsPerDay * 7
            runsPerMonth = runsPerDay * 30
        }
    } else if (type === 'TumblingWindowTrigger') {
        humanReadable = `Tumbling window: Every ${interval} ${frequency.toLowerCase()}(s)`
        if (frequency === 'Minute') {
            runsPerDay = (24 * 60) / interval
        } else if (frequency === 'Hour') {
            runsPerDay = 24 / interval
        } else if (frequency === 'Day') {
            runsPerDay = 1 / interval
        }
        runsPerWeek = runsPerDay * 7
        runsPerMonth = runsPerDay * 30
    } else if (type === 'BlobEventsTrigger') {
        humanReadable = 'Event-based (unpredictable)'
        // Event-based - estimate conservatively
        runsPerDay = 0
        runsPerWeek = 0
        runsPerMonth = 0
    } else {
        humanReadable = 'Custom/Event-based'
    }

    return { humanReadable, runsPerDay, runsPerWeek, runsPerMonth }
}

const parseTriggers = (json: any): TriggerInfo[] => {
    const triggers: TriggerInfo[] = []
    const triggerList = json.triggers || json.value || (Array.isArray(json) ? json : [json])

    triggerList.forEach((trigger: any) => {
        const props = trigger.properties || trigger
        const typeProps = props.typeProperties || {}
        const recurrence = typeProps.recurrence || {}

        let pipelines: string[] = []
        if (props.pipelines) {
            pipelines = props.pipelines.map((p: any) => p.pipelineReference?.referenceName || 'Unknown')
        } else if (props.pipeline) {
            pipelines = [props.pipeline.pipelineReference?.referenceName || 'Unknown']
        }

        const frequency = recurrence.frequency || typeProps.frequency || 'Event'
        const interval = recurrence.interval || typeProps.interval || 1
        const startTime = recurrence.startTime || typeProps.startTime || ''
        const timeZone = recurrence.timeZone || 'UTC'
        const startHour = startTime ? new Date(startTime).getUTCHours() : 0

        const { humanReadable, runsPerDay, runsPerWeek, runsPerMonth } = calculateScheduleMetrics(props.type, frequency, interval, recurrence, startTime)

        triggers.push({
            name: trigger.name || 'Unnamed',
            type: props.type || 'Unknown',
            state: props.runtimeState || 'Unknown',
            frequency,
            interval,
            startTime,
            timeZone,
            pipelines,
            humanReadable,
            runsPerDay,
            runsPerWeek,
            runsPerMonth,
            startHour
        })
    })

    return triggers
}

export default function TriggerScheduleVisualizer() {
    const [inputJson, setInputJson] = useState('')
    const [inputMode, setInputMode] = useState<'trigger' | 'arm'>('trigger')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const triggers = useMemo(() => {
        if (!inputJson.trim()) return []
        try {
            const parsed = JSON.parse(inputJson)
            // Detect ARM template format
            if (parsed.resources && Array.isArray(parsed.resources)) {
                return parseTriggersFromARM(parsed)
            }
            return parseTriggers(parsed)
        } catch {
            return []
        }
    }, [inputJson])

    const activeTriggers = useMemo(() => triggers.filter(t => t.state === 'Started'), [triggers])

    const summary = useMemo(() => {
        const totalTriggers = triggers.length
        const activeTriggerCount = activeTriggers.length
        const stoppedTriggers = triggers.filter(t => t.state === 'Stopped').length
        const uniquePipelines = new Set(triggers.flatMap(t => t.pipelines)).size
        const triggerTypes = new Map<string, number>()
        triggers.forEach(t => {
            triggerTypes.set(t.type, (triggerTypes.get(t.type) || 0) + 1)
        })
        return { totalTriggers, activeTriggerCount, stoppedTriggers, uniquePipelines, triggerTypes }
    }, [triggers, activeTriggers])

    const insights = useMemo(() => {
        if (activeTriggers.length === 0) return null

        // Calculate total runs
        const totalRunsPerDay = activeTriggers.reduce((sum, t) => sum + t.runsPerDay, 0)
        const totalRunsPerWeek = activeTriggers.reduce((sum, t) => sum + t.runsPerWeek, 0)
        const totalRunsPerMonth = activeTriggers.reduce((sum, t) => sum + t.runsPerMonth, 0)

        // Pipeline execution frequency
        const pipelineFrequency = new Map<string, number>()
        activeTriggers.forEach(t => {
            t.pipelines.forEach(p => {
                pipelineFrequency.set(p, (pipelineFrequency.get(p) || 0) + t.runsPerDay)
            })
        })
        const sortedPipelines = Array.from(pipelineFrequency.entries())
            .sort((a, b) => b[1] - a[1])

        // Busiest hours analysis (for scheduled triggers)
        const hourlyLoad = new Array(24).fill(0)
        activeTriggers.forEach(t => {
            if (t.frequency === 'Hour') {
                // Hourly triggers distribute across all hours
                for (let i = 0; i < 24; i++) {
                    hourlyLoad[i] += t.runsPerDay / 24
                }
            } else if (t.frequency === 'Day' || t.frequency === 'Week') {
                hourlyLoad[t.startHour] += t.runsPerDay
            } else if (t.frequency === 'Minute') {
                // Minute-based triggers run throughout the day
                for (let i = 0; i < 24; i++) {
                    hourlyLoad[i] += t.runsPerDay / 24
                }
            }
        })

        const maxLoad = Math.max(...hourlyLoad)
        const busiestHours = hourlyLoad
            .map((load, hour) => ({ hour, load }))
            .filter(h => h.load > 0)
            .sort((a, b) => b.load - a.load)
            .slice(0, 3)

        // Overlap detection
        const overlaps: { hour: number; triggers: string[] }[] = []
        for (let hour = 0; hour < 24; hour++) {
            const triggersAtHour = activeTriggers.filter(t => {
                if (t.frequency === 'Day' || t.frequency === 'Week') {
                    return t.startHour === hour
                }
                return false
            })
            if (triggersAtHour.length >= 2) {
                overlaps.push({ hour, triggers: triggersAtHour.map(t => t.name) })
            }
        }

        // Per-trigger run counts
        const triggerRunCounts = activeTriggers.map(t => ({
            name: t.name,
            daily: t.runsPerDay,
            weekly: t.runsPerWeek,
            monthly: t.runsPerMonth
        })).sort((a, b) => b.daily - a.daily)

        return {
            totalRunsPerDay,
            totalRunsPerWeek,
            totalRunsPerMonth,
            pipelineFrequency: sortedPipelines,
            hourlyLoad,
            maxLoad,
            busiestHours,
            overlaps,
            triggerRunCounts
        }
    }, [activeTriggers])

    const loadSample = () => {
        if (inputMode === 'arm') {
            setInputJson(JSON.stringify(SAMPLE_ARM_TEMPLATE, null, 2))
        } else {
            setInputJson(JSON.stringify(SAMPLE_TRIGGERS, null, 2))
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result as string
            setInputJson(content)
            // Auto-detect ARM template
            try {
                const parsed = JSON.parse(content)
                if (parsed.resources && Array.isArray(parsed.resources)) {
                    setInputMode('arm')
                } else {
                    setInputMode('trigger')
                }
            } catch {
                // Keep current mode
            }
        }
        reader.readAsText(file)
    }

    const getTypeIcon = (type: string) => {
        if (type.includes('Schedule')) return <Clock className="h-4 w-4" />
        if (type.includes('Tumbling')) return <Timer className="h-4 w-4" />
        if (type.includes('Blob') || type.includes('Event')) return <Zap className="h-4 w-4" />
        return <Play className="h-4 w-4" />
    }

    const getTypeColor = (type: string) => {
        if (type.includes('Schedule')) return 'bg-blue-500/10 text-blue-600 border-blue-500/30'
        if (type.includes('Tumbling')) return 'bg-purple-500/10 text-purple-600 border-purple-500/30'
        if (type.includes('Blob') || type.includes('Event')) return 'bg-orange-500/10 text-orange-600 border-orange-500/30'
        return 'bg-gray-500/10 text-gray-600 border-gray-500/30'
    }

    const formatNumber = (n: number) => {
        if (n === 0) return '0'
        if (n < 1) return n.toFixed(2)
        if (n < 10) return n.toFixed(1)
        return Math.round(n).toLocaleString()
    }

    const formatHour = (hour: number) => {
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const h = hour % 12 || 12
        return `${h}:00 ${ampm}`
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 w-full h-full max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    Trigger Schedule Visualizer
                </h1>
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <div className="flex bg-muted rounded-md p-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 text-xs ${inputMode === 'trigger' ? 'bg-background shadow-sm' : ''}`}
                            onClick={() => { setInputMode('trigger'); fileInputRef.current?.click(); }}
                        >
                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                            Upload Trigger JSON
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 text-xs ${inputMode === 'arm' ? 'bg-background shadow-sm' : ''}`}
                            onClick={() => { setInputMode('arm'); fileInputRef.current?.click(); }}
                        >
                            <FileJson className="mr-1.5 h-3.5 w-3.5" />
                            Upload ARM Template
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadSample}>
                        Load Sample
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInputJson('')} disabled={!inputJson}>
                        Clear
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Input Panel */}
                <div className="w-1/3 flex flex-col border rounded-lg overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2 text-sm font-medium border-b flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <FileJson className="h-4 w-4" />
                            Input ({inputMode === 'arm' ? 'ARM Template' : 'Trigger JSON'})
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setInputMode('trigger')}
                                className={`text-xs px-2 py-0.5 rounded ${inputMode === 'trigger' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                            >
                                Trigger
                            </button>
                            <button
                                onClick={() => setInputMode('arm')}
                                className={`text-xs px-2 py-0.5 rounded ${inputMode === 'arm' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                            >
                                ARM
                            </button>
                        </div>
                    </div>
                    <div className="flex-1">
                        <CodeEditor
                            value={inputJson}
                            onChange={(v) => setInputJson(v || '')}
                            language="json"
                            hideHeader
                        />
                    </div>
                </div>

                {/* Results Panel */}
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                    {triggers.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/20">
                            <div className="text-center text-muted-foreground">
                                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                <p className="text-sm font-medium">Paste ADF Trigger JSON or ARM Template</p>
                                <p className="text-xs mt-1">or click "Load Sample" to see an example</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold">{summary.totalTriggers}</div>
                                    <div className="text-xs text-muted-foreground">Total Triggers</div>
                                </div>
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold text-green-600">{summary.activeTriggerCount}</div>
                                    <div className="text-xs text-muted-foreground">Active (Started)</div>
                                </div>
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold text-red-600">{summary.stoppedTriggers}</div>
                                    <div className="text-xs text-muted-foreground">Stopped</div>
                                </div>
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold text-blue-600">{summary.uniquePipelines}</div>
                                    <div className="text-xs text-muted-foreground">Unique Pipelines</div>
                                </div>
                            </div>

                            {/* Trigger Type Breakdown */}
                            <div className="border rounded-lg p-4 bg-card">
                                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    Trigger Types
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {Array.from(summary.triggerTypes.entries()).map(([type, count]) => (
                                        <span key={type} className={`text-xs border px-3 py-1 rounded-full flex items-center gap-2 ${getTypeColor(type)}`}>
                                            {getTypeIcon(type)}
                                            {type}: {count}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Schedule Insights */}
                            {insights && (
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-primary/10 px-4 py-2 font-semibold text-sm border-b flex items-center gap-2 text-primary">
                                        <BarChart3 className="h-4 w-4" />
                                        Schedule Insights (Active Triggers Only)
                                    </div>
                                    <div className="p-4 space-y-4">
                                        {/* Run Count Estimates */}
                                        <div>
                                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4" />
                                                Estimated Pipeline Runs
                                            </h4>
                                            <div className="grid grid-cols-3 gap-4 text-center">
                                                <div className="border rounded p-3 bg-green-500/5">
                                                    <div className="text-xl font-bold text-green-600">{formatNumber(insights.totalRunsPerDay)}</div>
                                                    <div className="text-xs text-muted-foreground">Runs/Day</div>
                                                </div>
                                                <div className="border rounded p-3 bg-blue-500/5">
                                                    <div className="text-xl font-bold text-blue-600">{formatNumber(insights.totalRunsPerWeek)}</div>
                                                    <div className="text-xs text-muted-foreground">Runs/Week</div>
                                                </div>
                                                <div className="border rounded p-3 bg-purple-500/5">
                                                    <div className="text-xl font-bold text-purple-600">{formatNumber(insights.totalRunsPerMonth)}</div>
                                                    <div className="text-xs text-muted-foreground">Runs/Month</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Per-Trigger Run Counts */}
                                        <div>
                                            <h4 className="text-sm font-medium mb-2">Runs by Trigger</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/30">
                                                        <tr>
                                                            <th className="text-left px-3 py-2">Trigger</th>
                                                            <th className="text-right px-3 py-2">Daily</th>
                                                            <th className="text-right px-3 py-2">Weekly</th>
                                                            <th className="text-right px-3 py-2">Monthly</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {insights.triggerRunCounts.map((t, idx) => (
                                                            <tr key={idx} className="border-t">
                                                                <td className="px-3 py-2 font-medium">{t.name}</td>
                                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(t.daily)}</td>
                                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(t.weekly)}</td>
                                                                <td className="px-3 py-2 text-right font-mono">{formatNumber(t.monthly)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Busiest Hours */}
                                        {insights.busiestHours.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <Clock className="h-4 w-4" />
                                                    Busiest Hours (UTC)
                                                </h4>
                                                <div className="flex gap-2 flex-wrap">
                                                    {insights.busiestHours.map((h, idx) => (
                                                        <div key={idx} className={`border rounded px-3 py-2 ${idx === 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-muted/30'}`}>
                                                            <div className="font-mono text-sm font-bold">{formatHour(h.hour)}</div>
                                                            <div className="text-xs text-muted-foreground">{formatNumber(h.load)} runs</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Pipeline Load */}
                                        <div>
                                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                <Layers className="h-4 w-4" />
                                                Pipeline Execution Frequency (Daily)
                                            </h4>
                                            <div className="space-y-2">
                                                {insights.pipelineFrequency.map(([pipeline, freq], idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded min-w-[140px] truncate">{pipeline}</span>
                                                        <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary rounded-full"
                                                                style={{ width: `${Math.min(100, (freq / (insights.pipelineFrequency[0]?.[1] || 1)) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-mono text-muted-foreground w-16 text-right">{formatNumber(freq)}/day</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Overlap Warnings */}
                                        {insights.overlaps.length > 0 && (
                                            <div className="border border-yellow-500/30 rounded p-3 bg-yellow-500/5">
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-yellow-600">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    Schedule Overlaps Detected
                                                </h4>
                                                <div className="space-y-2">
                                                    {insights.overlaps.map((overlap, idx) => (
                                                        <div key={idx} className="text-sm">
                                                            <span className="font-mono text-yellow-600">{formatHour(overlap.hour)}</span>
                                                            <span className="text-muted-foreground"> — {overlap.triggers.join(', ')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Consider staggering these triggers to avoid resource contention.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Triggers Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b">
                                    Trigger Details
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/30">
                                            <tr>
                                                <th className="text-left px-4 py-2 border-b">Trigger Name</th>
                                                <th className="text-left px-4 py-2 border-b">Type</th>
                                                <th className="text-left px-4 py-2 border-b">State</th>
                                                <th className="text-left px-4 py-2 border-b">Schedule</th>
                                                <th className="text-left px-4 py-2 border-b">Pipelines</th>
                                                <th className="text-left px-4 py-2 border-b">Timezone</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {triggers.map((trigger, idx) => (
                                                <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                                                    <td className="px-4 py-2 font-medium">{trigger.name}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`text-xs border px-2 py-0.5 rounded flex items-center gap-1 w-fit ${getTypeColor(trigger.type)}`}>
                                                            {getTypeIcon(trigger.type)}
                                                            {trigger.type.replace('Trigger', '')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        {trigger.state === 'Started' ? (
                                                            <span className="text-green-600 flex items-center gap-1 text-xs">
                                                                <CheckCircle2 className="h-3 w-3" /> Active
                                                            </span>
                                                        ) : (
                                                            <span className="text-red-600 flex items-center gap-1 text-xs">
                                                                <AlertCircle className="h-3 w-3" /> Stopped
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-muted-foreground">{trigger.humanReadable}</td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-wrap gap-1">
                                                            {trigger.pipelines.map((p, i) => (
                                                                <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{p}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-xs font-mono">{trigger.timeZone}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                <strong>Tip:</strong> Export your trigger definitions from Azure Portal → Data Factory → Author → Triggers → Right-click → Export ARM Template or copy individual trigger JSON. ARM templates are automatically detected.
            </div>
        </div>
    )
}
