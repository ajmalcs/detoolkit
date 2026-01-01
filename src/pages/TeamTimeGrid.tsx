import { useState, useEffect } from 'react'
import { format, startOfToday, setHours, addDays, subDays, differenceInCalendarDays, isSameDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import TimezoneSelect, { type ITimezoneOption } from 'react-timezone-select'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { X, Plus, Clock, Calendar as CalendarIcon, GripVertical, Minimize2, Maximize2, Download } from 'lucide-react'
import { cn } from '../lib/utils'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Default Zones as requested
const DEFAULT_ZONES = [
    'UTC',
    'US/Eastern',
    'Asia/Kolkata'
]

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function TeamTimeGrid() {
    // State
    const [selectedZones, setSelectedZones] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('detools_timezones')
            return saved ? JSON.parse(saved) : DEFAULT_ZONES
        } catch (e) {
            console.error("Failed to parse saved zones", e)
            return DEFAULT_ZONES
        }
    })

    // Dates
    const [selectedDate, setSelectedDate] = useState(startOfToday())

    // Controlled input for adding new zones
    const [newZone, setNewZone] = useState<ITimezoneOption | null>(null)

    // Feature: 12h/24h Toggle
    const [is24Hour, setIs24Hour] = useState(false) // Default 12h (false)

    // Hover & Selection state
    const [hoverHour, setHoverHour] = useState<number | null>(null)
    const [selectedHour, setSelectedHour] = useState<number | null>(null)

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // Persist
    useEffect(() => {
        localStorage.setItem('detools_timezones', JSON.stringify(selectedZones))
    }, [selectedZones])

    // Handlers
    const addZone = () => {
        if (newZone && typeof newZone.value === 'string' && !selectedZones.includes(newZone.value)) {
            setSelectedZones([...selectedZones, newZone.value])
            setNewZone(null)
        }
    }

    const removeZone = (zone: string) => {
        setSelectedZones(selectedZones.filter(z => z !== zone))
    }

    const handleHourClick = (hour: number) => {
        setSelectedHour(h => h === hour ? null : hour)
    }

    const handleDragEnd = (event: any) => {
        const { active, over } = event

        if (active.id !== over.id) {
            setSelectedZones((items) => {
                const oldIndex = items.indexOf(active.id)
                const newIndex = items.indexOf(over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }

    // Generate Date Tabs: -1 day, Today, +1... +5 days
    const today = startOfToday()
    const dateTabs = [
        subDays(today, 1),
        today,
        addDays(today, 1),
        addDays(today, 2),
        addDays(today, 3),
        addDays(today, 4),
        addDays(today, 5),
    ]

    const [isFullScreen, setIsFullScreen] = useState(false)

    const handleDownload = () => {
        const text = selectedZones.map(zone => {
            const time = formatInTimeZone(new Date(), zone, 'yyyy-MM-dd HH:mm:ss zzzz')
            return `${zone}: ${time}`
        }).join('\n')

        const blob = new Blob([text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'team_times.txt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    return (
        <div className={`flex-1 flex flex-col p-6 gap-6 w-full h-full transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 bg-background overflow-auto' : 'max-w-7xl mx-auto'}`}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Clock className="w-6 h-6" /> Time Conversion
                    </h1>
                    <p className="text-muted-foreground">
                        Compare overlapping hours across timezones. Green cells indicate standard working hours (8 AM - 5 PM).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-muted/50 p-1 rounded-lg border">
                        <button
                            onClick={() => setIs24Hour(false)}
                            className={cn("px-3 py-1 rounded-md text-sm font-medium transition-all", !is24Hour ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            12h
                        </button>
                        <button
                            onClick={() => setIs24Hour(true)}
                            className={cn("px-3 py-1 rounded-md text-sm font-medium transition-all", is24Hour ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            24h
                        </button>
                    </div>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button variant="ghost" size="icon" onClick={handleDownload} title="Download Summary">
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

            {/* Controls Card */}
            <Card className="p-4 flex flex-col lg:flex-row gap-4 items-center bg-card z-20 overflow-visible relative">

                {/* Left: Location Controls */}
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto items-center">
                    <div className="w-full sm:w-64 relative z-50 text-foreground">
                        <TimezoneSelect
                            value={newZone}
                            onChange={(val) => setNewZone(val)}
                            placeholder="Add Location..."
                            {...({
                                styles: {
                                    control: (provided: any) => ({
                                        ...provided,
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--input))',
                                        color: 'hsl(var(--foreground))',
                                        minHeight: '2.5rem',
                                    }),
                                    singleValue: (provided: any) => ({
                                        ...provided,
                                        color: 'hsl(var(--foreground))',
                                    }),
                                    input: (provided: any) => ({
                                        ...provided,
                                        color: 'hsl(var(--foreground))',
                                    }),
                                    menu: (provided: any) => ({
                                        ...provided,
                                        backgroundColor: 'hsl(var(--popover))',
                                        zIndex: 9999,
                                        border: '1px solid hsl(var(--border))',
                                    }),
                                    menuPortal: (provided: any) => ({
                                        ...provided,
                                        zIndex: 9999
                                    }),
                                    option: (provided: any, state: any) => ({
                                        ...provided,
                                        backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'transparent',
                                        color: state.isFocused ? 'hsl(var(--accent-foreground))' : 'hsl(var(--popover-foreground))',
                                        cursor: 'pointer',
                                    }),
                                    placeholder: (provided: any) => ({
                                        ...provided,
                                        color: 'hsl(var(--muted-foreground))',
                                    }),
                                },
                            } as any)}
                            menuPortalTarget={document.body}
                        />
                    </div>
                    <Button onClick={addZone} disabled={!newZone} size="sm" className="w-full sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                </div>

                {/* Center: Date Tabs - Flexes to fill space or scroll */}
                <div className="flex-1 w-full lg:w-auto flex justify-center lg:justify-start lg:px-4 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1 min-w-max p-1">
                        {dateTabs.map(date => {
                            const isSelected = isSameDay(date, selectedDate)
                            const isTodayUrl = isSameDay(date, today)

                            return (
                                <button
                                    key={date.toISOString()}
                                    onClick={() => setSelectedDate(date)}
                                    className={cn(
                                        "flex flex-col items-center justify-center px-3 py-1 rounded-md border text-xs transition-all min-w-[3rem]",
                                        isSelected
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-background border-border hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                    )}
                                >
                                    <span className="font-semibold">{isTodayUrl ? "Today" : format(date, "EEE")}</span>
                                    <span className={cn("text-[9px]", isSelected ? "opacity-90" : "opacity-70")}>
                                        {format(date, "MMM d")}
                                    </span>
                                </button>
                            )
                        })}

                        {/* Calendar Picker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-[38px] w-9 ml-1 border border-dashed text-muted-foreground hover:text-foreground">
                                    <CalendarIcon className="w-4 h-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(d) => d && setSelectedDate(d)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Right: Reset Button */}
                <div className="flex shrink-0">
                    <Button variant="outline" size="sm" onClick={() => {
                        localStorage.removeItem('detools_timezones');
                        setSelectedZones(DEFAULT_ZONES);
                    }}>
                        Reset
                    </Button>
                </div>
            </Card>

            {/* Grid Container */}
            <div className="flex-1 overflow-visible border rounded-lg bg-background relative flex flex-col min-h-0">
                {/* Headers */}
                <div className="flex border-b bg-muted/30 sticky top-0 z-10 w-full shrink-0">
                    <div className="w-32 md:w-48 p-2 shrink-0 border-r bg-background sticky left-0 z-20 font-semibold text-sm flex items-center">
                        Location
                    </div>
                    {HOURS.map(hour => (
                        <div
                            key={hour}
                            onClick={() => handleHourClick(hour)}
                            className={cn(
                                "flex-1 min-w-0 p-2 text-center text-[10px] md:text-xs text-muted-foreground border-r last:border-r-0 flex items-center justify-center font-mono cursor-pointer transition-colors hover:bg-accent/50",
                                (hoverHour === hour || selectedHour === hour) && "bg-accent text-accent-foreground font-bold",
                                selectedHour === hour && "ring-2 ring-primary ring-inset z-30"
                            )}
                        >
                            {format(setHours(selectedDate, hour), is24Hour ? 'HH' : 'h a')}
                        </div>
                    ))}
                </div>

                {/* Rows */}
                <div className="flex-1 overflow-y-auto w-full" onMouseLeave={() => setHoverHour(null)}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={selectedZones}
                            strategy={verticalListSortingStrategy}
                        >
                            {selectedZones.map(zone => (
                                <SortableTimeRow
                                    key={zone}
                                    id={zone}
                                    zone={zone}
                                    date={selectedDate}
                                    onRemove={() => removeZone(zone)}
                                    hoverHour={hoverHour}
                                    selectedHour={selectedHour}
                                    onHourClick={handleHourClick}
                                    setHoverHour={setHoverHour}
                                    is24Hour={is24Hour}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    )
}

function SortableTimeRow(props: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: isDragging ? 'relative' as const : undefined,
        opacity: isDragging ? 0.8 : 1
    }

    return (
        <div ref={setNodeRef} style={style} className={cn(isDragging && "shadow-lg ring-1 ring-primary/20 rounded z-50")}>
            <TimeRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
        </div>
    )
}

function TimeRow({ zone, date, onRemove, hoverHour, selectedHour, onHourClick, setHoverHour, is24Hour, dragHandleProps }: {
    zone: string,
    date: Date,
    onRemove: () => void,
    hoverHour: number | null,
    selectedHour: number | null,
    onHourClick: (h: number) => void,
    setHoverHour: (h: number) => void
    is24Hour: boolean
    dragHandleProps?: any
}) {
    // Helper to get formatted time string for the cell
    const getCellTimeInfo = (hourIndex: number) => {
        const utcTime = setHours(date, hourIndex)
        // Check day diff relative to the grid time (which is date + hourIndex)
        const gridDay = format(utcTime, 'yyyy-MM-dd')
        const targetDay = formatInTimeZone(utcTime, zone, 'yyyy-MM-dd')

        const dayDiff = differenceInCalendarDays(new Date(targetDay), new Date(gridDay))

        return {
            text: formatInTimeZone(utcTime, zone, is24Hour ? 'HH' : 'h'),
            dayDiff
        }
    }

    // For logic (Work/Sleep hours) - always check against 24h number
    const getHourInZone = (hourIndex: number) => {
        const utcTime = setHours(date, hourIndex)
        return parseInt(formatInTimeZone(utcTime, zone, 'H'), 10)
    }

    const nowInZone = formatInTimeZone(new Date(), zone, is24Hour ? 'HH:mm' : 'h:mm a')
    const offset = formatInTimeZone(new Date(), zone, 'xxx')

    // Updated Logic: "City (Abbr - Full Name)"
    const city = zone.includes('/') ? zone.split('/')[1].replace('_', ' ') : zone
    const abbr = formatInTimeZone(new Date(), zone, 'z')
    const fullName = formatInTimeZone(new Date(), zone, 'zzzz')

    return (
        <div className="flex border-b hover:bg-muted/10 transition-colors group bg-background">
            <div className="w-32 md:w-48 p-2 shrink-0 border-r bg-background sticky left-0 z-10 flex items-center justify-between group-hover:bg-muted/10 transition-colors">

                {/* Drag Handle */}
                <div {...dragHandleProps} className="mr-2 cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                </div>

                <div className="flex flex-col min-w-0 flex-1 pr-1">
                    <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs truncate" title={city}>{city}</span>
                        <span className="text-[10px] font-mono text-foreground shrink-0">{nowInZone}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[9px] text-muted-foreground">
                        <span className="truncate" title={`${abbr} - ${fullName}`}>{abbr} - {fullName}</span>
                        <span className="shrink-0">({offset})</span>
                    </div>
                </div>
                <button
                    onClick={onRemove}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded transition-all shrink-0 ml-1"
                    title="Remove Zone"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
            {HOURS.map(i => {
                const hourInZone = getHourInZone(i)
                const isWorkHour = hourInZone >= 8 && hourInZone < 17
                const isSleepHour = hourInZone >= 23 || hourInZone < 7

                const { text, dayDiff } = getCellTimeInfo(i)

                return (
                    <div
                        key={i}
                        onMouseEnter={() => setHoverHour(i)}
                        onClick={() => onHourClick(i)}
                        className={cn(
                            "flex-1 min-w-0 p-1 border-r last:border-r-0 flex flex-col items-center justify-center font-mono cursor-pointer relative transition-all",
                            isWorkHour ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" :
                                isSleepHour ? "bg-slate-100 dark:bg-slate-900 text-slate-400" :
                                    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                            (hoverHour === i || selectedHour === i) && "ring-1 ring-inset ring-primary z-10 brightness-95 dark:brightness-110",
                            selectedHour === i && "ring-2 ring-primary z-20"
                        )}
                    >
                        <span className="text-[10px] md:text-xs">{text}</span>
                        {dayDiff !== 0 && (
                            <span className="text-[8px] leading-none opacity-70">
                                {dayDiff > 0 ? `+${dayDiff}` : dayDiff}
                            </span>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
