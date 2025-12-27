import { useEffect, useState } from "react"
import { Command } from "cmdk"
import { Search, FileCode, Braces, GitCompare, FileJson, Clock, Database } from "lucide-react"
import { useNavigate } from "react-router-dom"

export const tools = [
    { id: "sql", title: "SQL Formatter", icon: FileCode, path: "/sql", category: "SQL Suite", description: "Format and pretty-print SQL queries" },
    { id: "jdbc", title: "JDBC Builder", icon: Database, path: "/jdbc", category: "SQL Suite", description: "Generate JDBC connection strings" },
    { id: "json", title: "JSON Utilities", icon: Braces, path: "/json", category: "Data Formats", description: "Validate, format, and convert JSON" },
    { id: "diff", title: "Diff Checker", icon: GitCompare, path: "/diff", category: "Utils", description: "Compare text differences side-by-side" },
    { id: "csv", title: "CSV to JSON", icon: FileJson, path: "/csv", category: "Data Formats", description: "Convert CSV data to JSON array" },
    { id: "parquet", title: "Parquet Viewer", icon: Database, path: "/parquet", category: "Data Formats", description: "Query Parquet files with SQL (DuckDB)" },
    { id: "time", title: "Unix Time", icon: Clock, path: "/time", category: "Time & Utils", description: "Timestamp conversion utilities" },
    { id: "cron", title: "Airflow Cron", icon: Clock, path: "/cron", category: "Time & Utils", description: "Generate Airflow DAG schedules" },
    { id: "arn", title: "ARN Parser", icon: Database, path: "/arn", category: "Cloud Engineering", description: "Parse AWS ARN strings" },
    { id: "sql-analyzer", title: "SQL Analyzer", icon: Database, path: "/sql-analyzer", category: "SQL Suite", description: "Static analysis for performance anti-patterns" },
    { id: "sql-lineage", title: "SQL Lineage", icon: Database, path: "/sql-lineage", category: "SQL Suite", description: "Visualize table relationships and joins" },
    { id: "team-time", title: "Time Conversion", icon: Clock, path: "/team-time", category: "Time & Utils", description: "Compare overlapping working hours" },
]

export function SearchDialog() {
    const [open, setOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground bg-muted/50 hover:bg-muted/80 rounded-md border border-input transition-colors w-full max-w-md"
            >
                <Search className="w-4 h-4" />
                <span>Search tools...</span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 ml-auto">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <div
                        className="fixed left-[50%] top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-[10%]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Command className="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
                            <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Command.Input
                                    placeholder="Type a command or search..."
                                    className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
                                <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>
                                {["SQL Suite", "Data Formats", "Utils", "Time & Utils"].map(category => (
                                    <Command.Group key={category} heading={category} className="overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                                        {tools.filter(t => t.category === category).map(tool => (
                                            <Command.Item
                                                key={tool.id}
                                                value={tool.title}
                                                onSelect={() => {
                                                    navigate(tool.path)
                                                    setOpen(false)
                                                }}
                                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                                            >
                                                <tool.icon className="mr-2 h-4 w-4" />
                                                <span>{tool.title}</span>
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                ))}
                            </Command.List>
                        </Command>
                    </div>
                </div>
            )}
        </>
    )
}
