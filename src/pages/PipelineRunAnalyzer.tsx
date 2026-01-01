import { useState, useMemo, useRef } from 'react'
import { FileJson, Activity, CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp, FileSpreadsheet, BarChart3, PieChart, Target, AlertCircle, Calendar, Zap, Timer, Database } from 'lucide-react'
import { Button } from '../components/ui/button'
import { CodeEditor } from '../components/ui/code-editor'

// Sample run history data
const SAMPLE_RUNS = {
    "value": [
        { "runId": "run-001", "pipelineName": "Customer_Orders_Pipeline", "status": "Succeeded", "runStart": "2024-12-30T06:00:00Z", "runEnd": "2024-12-30T06:12:00Z", "durationInMs": 720000, "message": "" },
        { "runId": "run-002", "pipelineName": "Customer_Orders_Pipeline", "status": "Succeeded", "runStart": "2024-12-31T06:00:00Z", "runEnd": "2024-12-31T06:10:00Z", "durationInMs": 600000, "message": "" },
        { "runId": "run-003", "pipelineName": "Inventory_Sync_Pipeline", "status": "Failed", "runStart": "2024-12-30T08:00:00Z", "runEnd": "2024-12-30T08:05:00Z", "durationInMs": 300000, "message": "Connection timeout to source database" },
        { "runId": "run-004", "pipelineName": "Inventory_Sync_Pipeline", "status": "Succeeded", "runStart": "2024-12-30T09:00:00Z", "runEnd": "2024-12-30T09:08:00Z", "durationInMs": 480000, "message": "" },
        { "runId": "run-005", "pipelineName": "RealTime_Sales_Aggregation", "status": "Succeeded", "runStart": "2024-12-30T10:00:00Z", "runEnd": "2024-12-30T10:02:00Z", "durationInMs": 120000, "message": "" },
        { "runId": "run-006", "pipelineName": "RealTime_Sales_Aggregation", "status": "Succeeded", "runStart": "2024-12-30T11:00:00Z", "runEnd": "2024-12-30T11:02:00Z", "durationInMs": 120000, "message": "" },
        { "runId": "run-007", "pipelineName": "Full_Data_Refresh", "status": "Cancelled", "runStart": "2024-12-29T02:00:00Z", "runEnd": "2024-12-29T02:30:00Z", "durationInMs": 1800000, "message": "Manual cancellation by user" },
        { "runId": "run-008", "pipelineName": "Full_Data_Refresh", "status": "Succeeded", "runStart": "2024-12-30T02:00:00Z", "runEnd": "2024-12-30T02:45:00Z", "durationInMs": 2700000, "message": "" },
        { "runId": "run-009", "pipelineName": "Incremental_CDC_Load", "status": "Succeeded", "runStart": "2024-12-30T12:00:00Z", "runEnd": "2024-12-30T12:01:00Z", "durationInMs": 60000, "message": "" },
        { "runId": "run-010", "pipelineName": "Incremental_CDC_Load", "status": "Failed", "runStart": "2024-12-30T12:15:00Z", "runEnd": "2024-12-30T12:16:00Z", "durationInMs": 60000, "message": "Schema mismatch detected in target table" },
        { "runId": "run-011", "pipelineName": "Incremental_CDC_Load", "status": "Succeeded", "runStart": "2024-12-30T12:30:00Z", "runEnd": "2024-12-30T12:31:00Z", "durationInMs": 60000, "message": "" },
        { "runId": "run-012", "pipelineName": "Customer_Orders_Pipeline", "status": "InProgress", "runStart": "2024-12-31T06:00:00Z", "runEnd": null, "durationInMs": null, "message": "" },
        { "runId": "run-013", "pipelineName": "Customer_Orders_Pipeline", "status": "Succeeded", "runStart": "2024-12-28T06:00:00Z", "runEnd": "2024-12-28T06:15:00Z", "durationInMs": 900000, "message": "" },
        { "runId": "run-014", "pipelineName": "Customer_Orders_Pipeline", "status": "Succeeded", "runStart": "2024-12-27T06:00:00Z", "runEnd": "2024-12-27T06:11:00Z", "durationInMs": 660000, "message": "" },
        { "runId": "run-015", "pipelineName": "Inventory_Sync_Pipeline", "status": "Failed", "runStart": "2024-12-28T08:00:00Z", "runEnd": "2024-12-28T08:03:00Z", "durationInMs": 180000, "message": "Connection timeout to source database" },
        { "runId": "run-016", "pipelineName": "RealTime_Sales_Aggregation", "status": "Succeeded", "runStart": "2024-12-28T14:00:00Z", "runEnd": "2024-12-28T14:02:00Z", "durationInMs": 120000, "message": "" },
        { "runId": "run-017", "pipelineName": "Full_Data_Refresh", "status": "Succeeded", "runStart": "2024-12-27T02:00:00Z", "runEnd": "2024-12-27T03:30:00Z", "durationInMs": 5400000, "message": "" },
        { "runId": "run-018", "pipelineName": "Inventory_Sync_Pipeline", "status": "Succeeded", "runStart": "2024-12-29T08:00:00Z", "runEnd": "2024-12-29T10:00:00Z", "durationInMs": 7200000, "message": "ANOMALY: Took 2 hours instead of 8 mins" }
    ]
}

interface RunInfo {
    runId: string
    pipelineName: string
    status: string
    runStart: string
    runEnd: string | null
    durationInMs: number | null
    message: string
}

const parseRuns = (input: string, isCSV: boolean): RunInfo[] => {
    if (isCSV) {
        return parseCSV(input)
    }
    try {
        const json = JSON.parse(input)
        const runs = json.value || (Array.isArray(json) ? json : [json])
        return runs.map((run: any) => ({
            runId: run.runId || run['Run ID'] || 'N/A',
            pipelineName: run.pipelineName || run['Pipeline name'] || 'Unknown',
            status: run.status || run['Status'] || 'Unknown',
            runStart: run.runStart || run['Run start'] || '',
            runEnd: run.runEnd || run['Run end'] || null,
            durationInMs: run.durationInMs || parseDuration(run['Duration']),
            message: run.message || run['Error message'] || ''
        }))
    } catch {
        return []
    }
}

const parseCSV = (csv: string): RunInfo[] => {
    const lines = csv.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const runs: RunInfo[] = []

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => {
            row[h] = values[idx] || ''
        })

        runs.push({
            runId: row['Run ID'] || row['runId'] || `run-${i}`,
            pipelineName: row['Pipeline name'] || row['pipelineName'] || 'Unknown',
            status: row['Status'] || row['status'] || 'Unknown',
            runStart: row['Run start'] || row['runStart'] || '',
            runEnd: row['Run end'] || row['runEnd'] || null,
            durationInMs: parseDuration(row['Duration']) || parseInt(row['durationInMs']) || null,
            message: row['Error message'] || row['message'] || ''
        })
    }

    return runs
}

const parseDuration = (duration: string | undefined): number | null => {
    if (!duration) return null
    // Parse formats like "00:12:30" (HH:MM:SS) or "12m 30s"
    const hmsMatch = duration.match(/(\d+):(\d+):(\d+)/)
    if (hmsMatch) {
        const [, h, m, s] = hmsMatch.map(Number)
        return ((h * 60 + m) * 60 + s) * 1000
    }
    return null
}

const formatDuration = (ms: number | null): string => {
    if (ms === null) return '-'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
}

export default function PipelineRunAnalyzer() {
    const [inputData, setInputData] = useState('')
    const [inputMode, setInputMode] = useState<'json' | 'csv'>('json')
    const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'failures'>('overview')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const runs = useMemo(() => {
        if (!inputData.trim()) return []
        return parseRuns(inputData, inputMode === 'csv')
    }, [inputData, inputMode])

    const analytics = useMemo(() => {
        if (runs.length === 0) return null

        const totalRuns = runs.length
        const succeeded = runs.filter(r => r.status === 'Succeeded').length
        const failed = runs.filter(r => r.status === 'Failed').length
        const cancelled = runs.filter(r => r.status === 'Cancelled').length
        const inProgress = runs.filter(r => r.status === 'InProgress').length

        const successRate = totalRuns > 0 ? ((succeeded / totalRuns) * 100).toFixed(1) : '0'

        // Duration stats
        const completedRuns = runs.filter(r => r.durationInMs !== null)
        const avgDuration = completedRuns.length > 0
            ? completedRuns.reduce((sum, r) => sum + (r.durationInMs || 0), 0) / completedRuns.length
            : 0
        const maxDuration = completedRuns.length > 0
            ? Math.max(...completedRuns.map(r => r.durationInMs || 0))
            : 0
        const minDuration = completedRuns.length > 0
            ? Math.min(...completedRuns.map(r => r.durationInMs || 0))
            : 0

        // Per-pipeline stats
        const pipelineStats = new Map<string, { total: number; succeeded: number; failed: number; avgDuration: number; durations: number[] }>()
        runs.forEach(run => {
            const stat = pipelineStats.get(run.pipelineName) || { total: 0, succeeded: 0, failed: 0, avgDuration: 0, durations: [] }
            stat.total++
            if (run.status === 'Succeeded') stat.succeeded++
            if (run.status === 'Failed') stat.failed++
            if (run.durationInMs !== null) stat.durations.push(run.durationInMs)
            pipelineStats.set(run.pipelineName, stat)
        })

        // Calculate avg duration per pipeline
        pipelineStats.forEach((stat) => {
            if (stat.durations.length > 0) {
                stat.avgDuration = stat.durations.reduce((sum, d) => sum + d, 0) / stat.durations.length
            }
        })

        // Failed runs
        const failedRuns = runs.filter(r => r.status === 'Failed')

        return {
            totalRuns,
            succeeded,
            failed,
            cancelled,
            inProgress,
            successRate,
            avgDuration,
            maxDuration,
            minDuration,
            pipelineStats,
            failedRuns
        }
    }, [runs])

    const insights = useMemo(() => {
        if (runs.length === 0) return null

        const completedRuns = runs.filter(r => r.status !== 'InProgress')

        // Peak Hours Analysis
        const hourlyDistribution = new Array(24).fill(0)
        completedRuns.forEach(run => {
            if (run.runStart) {
                const hour = new Date(run.runStart).getHours()
                hourlyDistribution[hour]++
            }
        })
        const maxHourlyRuns = Math.max(...hourlyDistribution)
        const peakHours = hourlyDistribution
            .map((count, hour) => ({ hour, count }))
            .filter(h => h.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)

        // Day of Week Analysis
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dailyDistribution = new Array(7).fill(0)
        completedRuns.forEach(run => {
            if (run.runStart) {
                const day = new Date(run.runStart).getDay()
                dailyDistribution[day]++
            }
        })
        const maxDailyRuns = Math.max(...dailyDistribution)
        const busiestDays = dailyDistribution
            .map((count, day) => ({ day: dayNames[day], count }))
            .filter(d => d.count > 0)
            .sort((a, b) => b.count - a.count)

        // Reliability Score per pipeline
        const pipelineReliability = new Map<string, { successRate: number; avgDuration: number; variance: number; mtbf: number; runs: number }>()
        const pipelineRuns = new Map<string, RunInfo[]>()

        completedRuns.forEach(run => {
            const existing = pipelineRuns.get(run.pipelineName) || []
            existing.push(run)
            pipelineRuns.set(run.pipelineName, existing)
        })

        pipelineRuns.forEach((pRuns, name) => {
            const succeeded = pRuns.filter(r => r.status === 'Succeeded').length
            const failed = pRuns.filter(r => r.status === 'Failed').length
            const successRate = pRuns.length > 0 ? (succeeded / pRuns.length) * 100 : 0

            // Duration variance
            const durations = pRuns.filter(r => r.durationInMs !== null).map(r => r.durationInMs!)
            const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
            const variance = durations.length > 1
                ? Math.sqrt(durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length)
                : 0

            // MTBF (Mean Time Between Failures) - simplified
            const sortedRuns = [...pRuns].sort((a, b) => new Date(a.runStart).getTime() - new Date(b.runStart).getTime())
            let totalTimeBetweenFailures = 0
            let failureCount = 0
            let lastFailureTime: number | null = null

            sortedRuns.forEach(run => {
                if (run.status === 'Failed') {
                    const runTime = new Date(run.runStart).getTime()
                    if (lastFailureTime !== null) {
                        totalTimeBetweenFailures += runTime - lastFailureTime
                        failureCount++
                    }
                    lastFailureTime = runTime
                }
            })

            const mtbf = failureCount > 0 ? totalTimeBetweenFailures / failureCount : (pRuns.length > 0 && failed === 0 ? Infinity : 0)

            pipelineReliability.set(name, { successRate, avgDuration, variance, mtbf, runs: pRuns.length })
        })

        // Sort by reliability (success rate first, then variance)
        const sortedReliability = Array.from(pipelineReliability.entries())
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.successRate - a.successRate || a.variance - b.variance)

        // Error Pattern Analysis
        const errorPatterns = new Map<string, { count: number; pipelines: Set<string> }>()
        runs.filter(r => r.status === 'Failed' && r.message).forEach(run => {
            // Normalize error message for grouping
            const normalizedError = run.message.toLowerCase()
                .replace(/\d+/g, 'N')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 100)

            const pattern = errorPatterns.get(normalizedError) || { count: 0, pipelines: new Set<string>() }
            pattern.count++
            pattern.pipelines.add(run.pipelineName)
            errorPatterns.set(normalizedError, pattern)
        })

        const sortedErrors = Array.from(errorPatterns.entries())
            .map(([message, stats]) => ({
                message: runs.find(r => r.message.toLowerCase().includes(message.slice(0, 20)))?.message || message,
                count: stats.count,
                pipelines: Array.from(stats.pipelines)
            }))
            .sort((a, b) => b.count - a.count)

        // Total Execution Time
        const totalExecutionTime = completedRuns
            .filter(r => r.durationInMs !== null)
            .reduce((sum, r) => sum + (r.durationInMs || 0), 0)

        // Execution Density (runs per hour over the data span)
        const runTimes = completedRuns.map(r => new Date(r.runStart).getTime()).filter(t => !isNaN(t))
        const timeSpanHours = runTimes.length >= 2
            ? (Math.max(...runTimes) - Math.min(...runTimes)) / (1000 * 60 * 60)
            : 1
        const executionDensity = timeSpanHours > 0 ? completedRuns.length / timeSpanHours : 0

        // Duration Trend (compare first half vs second half)
        const runsWithDuration = completedRuns.filter(r => r.durationInMs !== null)
            .sort((a, b) => new Date(a.runStart).getTime() - new Date(b.runStart).getTime())

        let durationTrend: 'improving' | 'degrading' | 'stable' = 'stable'
        let durationChange = 0

        if (runsWithDuration.length >= 4) {
            const mid = Math.floor(runsWithDuration.length / 2)
            const firstHalf = runsWithDuration.slice(0, mid)
            const secondHalf = runsWithDuration.slice(mid)

            const firstHalfAvg = firstHalf.reduce((sum, r) => sum + (r.durationInMs || 0), 0) / firstHalf.length
            const secondHalfAvg = secondHalf.reduce((sum, r) => sum + (r.durationInMs || 0), 0) / secondHalf.length

            durationChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
            if (durationChange < -10) durationTrend = 'improving'
            else if (durationChange > 10) durationTrend = 'degrading'
        }

        // Cumulative Execution Time (Total resource footprint)
        const cumulativeStats = Array.from(pipelineReliability.entries())
            .map(([name, stats]) => {
                const totalDuration = pipelineRuns.get(name)?.reduce((sum, r) => sum + (r.durationInMs || 0), 0) || 0
                return { name, totalDuration, runs: stats.runs }
            })
            .sort((a, b) => b.totalDuration - a.totalDuration)

        // Anomaly Detection (Slow Runs)
        const slowRuns: (RunInfo & { avgDuration: number; deviation: number })[] = []
        pipelineRuns.forEach((pRuns, name) => {
            const stats = pipelineReliability.get(name)
            if (stats && stats.avgDuration > 0) {
                pRuns.forEach(run => {
                    if (run.durationInMs && run.durationInMs > stats.avgDuration * 1.5) {
                        slowRuns.push({
                            ...run,
                            avgDuration: stats.avgDuration,
                            deviation: ((run.durationInMs - stats.avgDuration) / stats.avgDuration) * 100
                        })
                    }
                })
            }
        })
        slowRuns.sort((a, b) => b.deviation - a.deviation)

        return {
            hourlyDistribution,
            maxHourlyRuns,
            peakHours,
            dailyDistribution,
            maxDailyRuns,
            busiestDays,
            sortedReliability,
            sortedErrors,
            totalExecutionTime,
            executionDensity,
            durationTrend,
            durationChange,
            cumulativeStats,
            slowRuns
        }
    }, [runs])

    const loadSample = () => {
        setInputMode('json')
        setInputData(JSON.stringify(SAMPLE_RUNS, null, 2))
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result as string
            if (file.name.endsWith('.csv')) {
                setInputMode('csv')
            } else {
                setInputMode('json')
            }
            setInputData(content)
        }
        reader.readAsText(file)
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Succeeded': return <CheckCircle2 className="h-4 w-4 text-green-600" />
            case 'Failed': return <XCircle className="h-4 w-4 text-red-600" />
            case 'Cancelled': return <AlertTriangle className="h-4 w-4 text-yellow-600" />
            case 'InProgress': return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            default: return <Activity className="h-4 w-4 text-gray-600" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Succeeded': return 'bg-green-500/10 text-green-600 border-green-500/30'
            case 'Failed': return 'bg-red-500/10 text-red-600 border-red-500/30'
            case 'Cancelled': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30'
            case 'InProgress': return 'bg-blue-500/10 text-blue-600 border-blue-500/30'
            default: return 'bg-gray-500/10 text-gray-600 border-gray-500/30'
        }
    }

    const formatHour = (hour: number) => {
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const h = hour % 12 || 12
        return `${h}:00 ${ampm}`
    }

    const getReliabilityColor = (rate: number) => {
        if (rate >= 95) return 'text-green-600'
        if (rate >= 80) return 'text-yellow-600'
        return 'text-red-600'
    }

    const getReliabilityBadge = (rate: number) => {
        if (rate >= 95) return { text: 'Excellent', class: 'bg-green-500/10 text-green-600 border-green-500/30' }
        if (rate >= 80) return { text: 'Good', class: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' }
        if (rate >= 50) return { text: 'Fair', class: 'bg-orange-500/10 text-orange-600 border-orange-500/30' }
        return { text: 'Poor', class: 'bg-red-500/10 text-red-600 border-red-500/30' }
    }

    return (
        <div className="flex-1 flex flex-col p-4 gap-4 w-full h-full max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-primary" />
                    Pipeline Run Log Analyzer
                </h1>
                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <div className="flex bg-muted rounded-md p-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 text-xs ${inputMode === 'json' ? 'bg-background shadow-sm' : ''}`}
                            onClick={() => { setInputMode('json'); fileInputRef.current?.click(); }}
                        >
                            <FileJson className="mr-1.5 h-3.5 w-3.5" />
                            Upload JSON
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 text-xs ${inputMode === 'csv' ? 'bg-background shadow-sm' : ''}`}
                            onClick={() => { setInputMode('csv'); fileInputRef.current?.click(); }}
                        >
                            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                            Upload CSV
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadSample}>
                        Load Sample
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInputData('')} disabled={!inputData}>
                        Clear
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Input Panel */}
                <div className="w-1/3 flex flex-col border rounded-lg overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2 text-sm font-medium border-b flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            {inputMode === 'csv' ? <FileSpreadsheet className="h-4 w-4" /> : <FileJson className="h-4 w-4" />}
                            Run History ({inputMode.toUpperCase()})
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setInputMode('json')}
                                className={`text-xs px-2 py-0.5 rounded ${inputMode === 'json' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                            >
                                JSON
                            </button>
                            <button
                                onClick={() => setInputMode('csv')}
                                className={`text-xs px-2 py-0.5 rounded ${inputMode === 'csv' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                            >
                                CSV
                            </button>
                        </div>
                    </div>
                    <div className="flex-1">
                        <CodeEditor
                            value={inputData}
                            onChange={(v) => setInputData(v || '')}
                            language={inputMode === 'csv' ? 'plaintext' : 'json'}
                            hideHeader
                        />
                    </div>
                </div>

                {/* Results Panel */}
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                    {!analytics ? (
                        <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/20">
                            <div className="text-center text-muted-foreground">
                                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                <p className="text-sm font-medium">Paste Pipeline Run History</p>
                                <p className="text-xs mt-1">Supports JSON from REST API or CSV export from Azure Portal</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-5 gap-3">
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold">{analytics.totalRuns}</div>
                                    <div className="text-xs text-muted-foreground">Total Runs</div>
                                </div>
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold text-green-600">{analytics.succeeded}</div>
                                    <div className="text-xs text-muted-foreground">Succeeded</div>
                                </div>
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold text-red-600">{analytics.failed}</div>
                                    <div className="text-xs text-muted-foreground">Failed</div>
                                </div>
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold text-primary">{analytics.successRate}%</div>
                                    <div className="text-xs text-muted-foreground">Success Rate</div>
                                </div>
                                <div className="border rounded-lg p-4 bg-card">
                                    <div className="text-2xl font-bold">{formatDuration(analytics.avgDuration)}</div>
                                    <div className="text-xs text-muted-foreground">Avg Duration</div>
                                </div>
                            </div>

                            {/* Tab Navigation */}
                            <div className="flex gap-1 border-b pb-0">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab('insights')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'insights' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    Insights
                                </button>
                                <button
                                    onClick={() => setActiveTab('failures')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'failures' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    Failures ({analytics.failed})
                                </button>
                            </div>

                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <>
                                    {/* Duration Stats */}
                                    <div className="border rounded-lg p-4 bg-card">
                                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4" />
                                            Duration Statistics
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div>
                                                <div className="text-lg font-mono">{formatDuration(analytics.minDuration)}</div>
                                                <div className="text-xs text-muted-foreground">Min Duration</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-mono">{formatDuration(analytics.avgDuration)}</div>
                                                <div className="text-xs text-muted-foreground">Avg Duration</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-mono">{formatDuration(analytics.maxDuration)}</div>
                                                <div className="text-xs text-muted-foreground">Max Duration</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Architectural Summary (Visible on Overview for quick access) */}
                                    {insights && (
                                        <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-primary">
                                                <Database className="h-4 w-4" />
                                                Architectural Highlights
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-1">
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Top Resource Whale</div>
                                                    <div className="text-sm font-medium truncate" title={insights.cumulativeStats[0]?.name}>
                                                        {insights.cumulativeStats[0]?.name || 'N/A'}
                                                    </div>
                                                    <div className="text-xs font-mono text-primary">{formatDuration(insights.cumulativeStats[0]?.totalDuration || 0)}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Main Bottleneck</div>
                                                    <div className="text-sm font-medium truncate" title={insights.sortedReliability.sort((a, b) => b.avgDuration - a.avgDuration)[0]?.name}>
                                                        {insights.sortedReliability.sort((a, b) => b.avgDuration - a.avgDuration)[0]?.name || 'N/A'}
                                                    </div>
                                                    <div className="text-xs font-mono text-primary">{formatDuration(insights.sortedReliability.sort((a, b) => b.avgDuration - a.avgDuration)[0]?.avgDuration || 0)}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Anomalies Detected</div>
                                                    <div className="text-xl font-bold flex items-center gap-2">
                                                        {insights.slowRuns.length}
                                                        {insights.slowRuns.length > 0 && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground cursor-pointer hover:underline" onClick={() => setActiveTab('insights')}>View details in Insights tab →</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Reliability Score</div>
                                                    <div className="text-xl font-bold">{analytics.successRate}%</div>
                                                    <div className="text-[10px] text-muted-foreground italic">Target: 99.9%</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Per-Pipeline Breakdown */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b flex items-center gap-2">
                                            <PieChart className="h-4 w-4" />
                                            Pipeline Breakdown
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/30">
                                                <tr>
                                                    <th className="text-left px-4 py-2 border-b">Pipeline</th>
                                                    <th className="text-center px-4 py-2 border-b">Total</th>
                                                    <th className="text-center px-4 py-2 border-b">Succeeded</th>
                                                    <th className="text-center px-4 py-2 border-b">Failed</th>
                                                    <th className="text-center px-4 py-2 border-b">Success Rate</th>
                                                    <th className="text-center px-4 py-2 border-b">Avg Duration</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Array.from(analytics.pipelineStats.entries()).map(([name, stat]) => (
                                                    <tr key={name} className="border-b last:border-b-0 hover:bg-muted/20">
                                                        <td className="px-4 py-2 font-medium">{name}</td>
                                                        <td className="px-4 py-2 text-center">{stat.total}</td>
                                                        <td className="px-4 py-2 text-center text-green-600">{stat.succeeded}</td>
                                                        <td className="px-4 py-2 text-center text-red-600">{stat.failed}</td>
                                                        <td className="px-4 py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-xs ${stat.total > 0 ? (stat.succeeded / stat.total >= 0.9 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600') : ''}`}>
                                                                {stat.total > 0 ? ((stat.succeeded / stat.total) * 100).toFixed(0) : 0}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 text-center font-mono text-xs">{formatDuration(stat.avgDuration)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* All Runs Table */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b">
                                            All Runs ({runs.length})
                                        </div>
                                        <div className="overflow-x-auto max-h-64">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/30 sticky top-0">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 border-b">Pipeline</th>
                                                        <th className="text-left px-4 py-2 border-b">Status</th>
                                                        <th className="text-left px-4 py-2 border-b">Start Time</th>
                                                        <th className="text-left px-4 py-2 border-b">Duration</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {runs.map((run, idx) => (
                                                        <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                                                            <td className="px-4 py-2">{run.pipelineName}</td>
                                                            <td className="px-4 py-2">
                                                                <span className={`text-xs border px-2 py-0.5 rounded flex items-center gap-1 w-fit ${getStatusColor(run.status)}`}>
                                                                    {getStatusIcon(run.status)}
                                                                    {run.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-xs font-mono">{new Date(run.runStart).toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-xs font-mono">{formatDuration(run.durationInMs)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Insights Tab */}
                            {activeTab === 'insights' && insights && (
                                <div className="space-y-4">
                                    {/* Execution Metrics */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="border rounded-lg p-4 bg-card">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Timer className="h-4 w-4 text-primary" />
                                                <span className="text-xs text-muted-foreground">Total Execution Time</span>
                                            </div>
                                            <div className="text-xl font-bold">{formatDuration(insights.totalExecutionTime)}</div>
                                        </div>
                                        <div className="border rounded-lg p-4 bg-card">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Zap className="h-4 w-4 text-primary" />
                                                <span className="text-xs text-muted-foreground">Execution Density</span>
                                            </div>
                                            <div className="text-xl font-bold">{insights.executionDensity.toFixed(1)}<span className="text-sm text-muted-foreground">/hr</span></div>
                                        </div>
                                        <div className="border rounded-lg p-4 bg-card">
                                            <div className="flex items-center gap-2 mb-2">
                                                <TrendingUp className="h-4 w-4 text-primary" />
                                                <span className="text-xs text-muted-foreground">Duration Trend</span>
                                            </div>
                                            <div className={`text-xl font-bold ${insights.durationTrend === 'improving' ? 'text-green-600' : insights.durationTrend === 'degrading' ? 'text-red-600' : ''}`}>
                                                {insights.durationTrend === 'improving' ? '↓ Improving' : insights.durationTrend === 'degrading' ? '↑ Degrading' : '→ Stable'}
                                            </div>
                                            {insights.durationChange !== 0 && (
                                                <div className="text-xs text-muted-foreground">
                                                    {insights.durationChange > 0 ? '+' : ''}{insights.durationChange.toFixed(1)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Architectural Insights Section */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Resource Whales - Total Time Spent */}
                                        <div className="border rounded-lg overflow-hidden flex flex-col">
                                            <div className="bg-primary/5 px-4 py-2 font-semibold text-sm border-b flex items-center gap-2">
                                                <Database className="h-4 w-4 text-primary" />
                                                Resource Whales (Total Time Spent)
                                            </div>
                                            <div className="p-4 flex-1 space-y-3">
                                                {insights.cumulativeStats.slice(0, 5).map((p, idx) => (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="font-medium truncate max-w-[200px]">{p.name}</span>
                                                            <span className="font-mono text-muted-foreground">{formatDuration(p.totalDuration)}</span>
                                                        </div>
                                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary/60 rounded-full"
                                                                style={{ width: `${(p.totalDuration / insights.cumulativeStats[0].totalDuration) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                {insights.cumulativeStats.length === 0 && (
                                                    <div className="text-center text-xs text-muted-foreground py-4 italic">No cumulative data available</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottleneck Analysis */}
                                        <div className="border rounded-lg overflow-hidden flex flex-col">
                                            <div className="bg-red-500/5 px-4 py-2 font-semibold text-sm border-b flex items-center gap-2">
                                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                                Top Bottlenecks (Avg Duration)
                                            </div>
                                            <div className="p-4 flex-1">
                                                <div className="space-y-3">
                                                    {insights.sortedReliability
                                                        .sort((a, b) => b.avgDuration - a.avgDuration)
                                                        .slice(0, 5)
                                                        .map((p, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-transparent hover:border-muted-foreground/10 transition-colors">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-medium">{p.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground">{p.runs} runs total</span>
                                                                </div>
                                                                <div className="text-xs font-mono font-bold">{formatDuration(p.avgDuration)}</div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Efficiency Anomalies */}
                                    {insights.slowRuns.length > 0 && (
                                        <div className="border rounded-lg overflow-hidden border-yellow-500/30">
                                            <div className="bg-yellow-500/10 px-4 py-2 font-semibold text-sm border-b border-yellow-500/30 flex items-center gap-2 text-yellow-700">
                                                <Zap className="h-4 w-4" />
                                                Efficiency Anomalies (Significant Deviations)
                                            </div>
                                            <table className="w-full text-sm">
                                                <thead className="bg-yellow-500/5">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 border-b border-yellow-500/10">Pipeline</th>
                                                        <th className="text-center px-4 py-2 border-b border-yellow-500/10">Run Start</th>
                                                        <th className="text-center px-4 py-2 border-b border-yellow-500/10">Run Duration</th>
                                                        <th className="text-center px-4 py-2 border-b border-yellow-500/10">Typical Avg</th>
                                                        <th className="text-center px-4 py-2 border-b border-yellow-500/10">Deviation</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {insights.slowRuns.slice(0, 5).map((run, idx) => (
                                                        <tr key={idx} className="border-b border-yellow-500/10 last:border-b-0 hover:bg-yellow-500/5">
                                                            <td className="px-4 py-2 font-medium">{run.pipelineName}</td>
                                                            <td className="px-4 py-2 text-center text-xs text-muted-foreground">{new Date(run.runStart).toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-center font-mono text-red-600 font-semibold">{formatDuration(run.durationInMs)}</td>
                                                            <td className="px-4 py-2 text-center font-mono text-xs">{formatDuration(run.avgDuration)}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-bold">
                                                                    +{run.deviation.toFixed(0)}% slow
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {insights.slowRuns.length > 5 && (
                                                <div className="p-2 text-center text-[10px] text-muted-foreground border-t border-yellow-500/10">
                                                    Showing top 5 anomalous runs out of {insights.slowRuns.length}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Peak Hours */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            Peak Execution Hours
                                        </div>
                                        <div className="p-4">
                                            <div className="flex gap-2 flex-wrap mb-4">
                                                {insights.peakHours.map((h, idx) => (
                                                    <div key={idx} className={`border rounded px-3 py-2 ${idx === 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-muted/30'}`}>
                                                        <div className="font-mono text-sm font-bold">{formatHour(h.hour)}</div>
                                                        <div className="text-xs text-muted-foreground">{h.count} runs</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Hour distribution bar chart */}
                                            <div className="flex gap-0.5 h-16 items-end">
                                                {insights.hourlyDistribution.map((count, hour) => (
                                                    <div
                                                        key={hour}
                                                        className="flex-1 bg-primary/30 hover:bg-primary/50 transition-colors rounded-t relative group"
                                                        style={{ height: count > 0 ? `${Math.max(10, (count / insights.maxHourlyRuns) * 100)}%` : '2px' }}
                                                        title={`${formatHour(hour)}: ${count} runs`}
                                                    >
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                                                            {formatHour(hour)}: {count} runs
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                                <span>12 AM</span>
                                                <span>6 AM</span>
                                                <span>12 PM</span>
                                                <span>6 PM</span>
                                                <span>12 AM</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Day of Week Distribution */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Day of Week Distribution
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {insights.busiestDays.map((d, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className="w-24 text-sm">{d.day}</span>
                                                    <div className="flex-1 bg-muted/30 rounded-full h-3 overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary rounded-full transition-all"
                                                            style={{ width: `${(d.count / insights.maxDailyRuns) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-mono text-muted-foreground w-12 text-right">{d.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pipeline Reliability */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <div className="bg-muted/50 px-4 py-2 font-semibold text-sm border-b flex items-center gap-2">
                                            <Target className="h-4 w-4" />
                                            Pipeline Reliability Ranking
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/30">
                                                <tr>
                                                    <th className="text-left px-4 py-2 border-b">Pipeline</th>
                                                    <th className="text-center px-4 py-2 border-b">Runs</th>
                                                    <th className="text-center px-4 py-2 border-b">Success Rate</th>
                                                    <th className="text-center px-4 py-2 border-b">Reliability</th>
                                                    <th className="text-center px-4 py-2 border-b">Avg Duration</th>
                                                    <th className="text-center px-4 py-2 border-b">Variance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {insights.sortedReliability.map((p, idx) => {
                                                    const badge = getReliabilityBadge(p.successRate)
                                                    return (
                                                        <tr key={idx} className="border-b last:border-b-0 hover:bg-muted/20">
                                                            <td className="px-4 py-2 font-medium">{p.name}</td>
                                                            <td className="px-4 py-2 text-center">{p.runs}</td>
                                                            <td className={`px-4 py-2 text-center font-bold ${getReliabilityColor(p.successRate)}`}>
                                                                {p.successRate.toFixed(0)}%
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className={`text-xs border px-2 py-0.5 rounded ${badge.class}`}>
                                                                    {badge.text}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2 text-center font-mono text-xs">{formatDuration(p.avgDuration)}</td>
                                                            <td className="px-4 py-2 text-center font-mono text-xs">{formatDuration(p.variance)}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Error Patterns */}
                                    {insights.sortedErrors.length > 0 && (
                                        <div className="border rounded-lg overflow-hidden border-red-500/30">
                                            <div className="bg-red-500/10 px-4 py-2 font-semibold text-sm border-b border-red-500/30 flex items-center gap-2 text-red-600">
                                                <AlertCircle className="h-4 w-4" />
                                                Common Error Patterns
                                            </div>
                                            <div className="divide-y">
                                                {insights.sortedErrors.map((err, idx) => (
                                                    <div key={idx} className="p-3">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-medium">{err.message}</span>
                                                            <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded">
                                                                {err.count}x
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {err.pipelines.map((p, i) => (
                                                                <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
                                                                    {p}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Failures Tab */}
                            {activeTab === 'failures' && (
                                <>
                                    {analytics.failedRuns.length > 0 ? (
                                        <div className="border rounded-lg overflow-hidden border-red-500/30">
                                            <div className="bg-red-500/10 px-4 py-2 font-semibold text-sm border-b border-red-500/30 flex items-center gap-2 text-red-600">
                                                <XCircle className="h-4 w-4" />
                                                Failed Runs ({analytics.failedRuns.length})
                                            </div>
                                            <div className="divide-y">
                                                {analytics.failedRuns.map((run, idx) => (
                                                    <div key={idx} className="p-3 bg-red-500/5">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-medium text-sm">{run.pipelineName}</span>
                                                            <span className="text-xs text-muted-foreground">{new Date(run.runStart).toLocaleString()}</span>
                                                        </div>
                                                        <div className="text-xs text-red-600 bg-red-500/10 p-2 rounded">
                                                            {run.message || 'No error message available'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center border rounded-lg bg-green-500/5 border-green-500/30">
                                            <div className="text-center text-green-600">
                                                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-60" />
                                                <p className="text-sm font-medium">No Failures Detected!</p>
                                                <p className="text-xs mt-1 text-muted-foreground">All pipelines executed successfully</p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                <strong>Tip:</strong> Export run history from Azure Portal → Data Factory → Monitor → Pipeline runs → Export to CSV. Or use the REST API: GET https://management.azure.com/.../pipelineruns
            </div>
        </div>
    )
}
