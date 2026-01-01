import { useState, useEffect } from 'react'
import { format, fromUnixTime, getUnixTime } from 'date-fns'
import { Copy, Clock, RefreshCw, Minimize2, Maximize2, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

export default function TimeConverter() {
    const [now, setNow] = useState(new Date())
    const [timestamp, setTimestamp] = useState('')
    const [readableDate, setReadableDate] = useState('')

    // Update "Current Time" every second
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const handleConvert = () => {
        if (!timestamp) return
        try {
            const ts = parseInt(timestamp)
            // Detect if ms or seconds (simple heuristic: if > 20000000000, likely ms, but let's assume seconds by default as per Unix standard, or handle typical ranges)
            // Usually, 10 digits is seconds, 13 digits is ms.
            // Let's assume input is SECONDS unless user specifies? Or auto-detect. 
            // Standard Unix is seconds.
            // Let's support both or just Seconds. Standard is Seconds.
            // I'll stick to seconds for strict "Unix Time".
            const date = fromUnixTime(ts)
            setReadableDate(format(date, 'yyyy-MM-dd HH:mm:ss'))
        } catch (e) {
            setReadableDate("Invalid Timestamp")
        }
    }

    // Auto convert when typing
    useEffect(() => {
        handleConvert()
    }, [timestamp])

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }


    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        if (!readableDate) return
        const blob = new Blob([readableDate], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `timestamp_${timestamp}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`h-full flex flex-col p-6 gap-6 w-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background overflow-auto' : 'max-w-4xl mx-auto'}`}>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Unix Time Converter</h1>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleDownload} disabled={!readableDate} title="Download Result">
                        <Download className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
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

            {/* Current Time Card */}
            <Card className="p-6 bg-accent/20">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Unix Time</h2>
                        <div className="text-4xl font-mono font-bold text-primary">
                            {getUnixTime(now)}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Date (UTC)</h2>
                        <div className="text-xl font-mono">
                            {now.toUTCString()}
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Unix to Date */}
                <Card className="p-6 flex flex-col gap-4">
                    <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Unix Timestamp to Date</h3>
                    <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Enter Timestamp (Seconds)</label>
                        <div className="flex gap-2">
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                                placeholder={getUnixTime(now).toString()}
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-muted rounded-md min-h-[60px] flex items-center justify-between">
                        <span className="font-mono text-lg">{readableDate || "Enter timestamp..."}</span>
                        {readableDate && (
                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(readableDate)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </Card>

                {/* Date to Unix */}
                <Card className="p-6 flex flex-col gap-4">
                    <h3 className="font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Date to Unix Timestamp</h3>
                    <div className="text-muted-foreground text-sm italic">
                        (Functionality to pick a date and get timestamp - Placeholder for now as user prioritized other tools, but simple to add if time permits)
                    </div>
                    {/* Simple current time copy */}
                    <div className="mt-auto">
                        <Button variant="outline" className="w-full" onClick={() => copyToClipboard(getUnixTime(now).toString())}>
                            Copy Current Timestamp
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    )
}
