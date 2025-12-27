import { Link, useLocation } from 'react-router-dom'
import { Search, X, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { tools } from '../dashboard/SearchDialog'

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const [search, setSearch] = useState('')
    const location = useLocation()

    // Reset search when closing/opening
    useEffect(() => {
        if (!isOpen) setTimeout(() => setSearch(''), 300)
    }, [isOpen])

    // Filter tools
    const filteredTools = tools.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
    )

    const categories = Array.from(new Set(filteredTools.map(t => t.category)))

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 transition-all duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-background border-r border-border shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <Link to="/" onClick={onClose} className="flex items-center gap-2 font-bold text-foreground">
                        <img src="/logo.png" alt="DEtools" className="h-6 w-auto" />
                    </Link>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-border">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search tools..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-muted/50 border border-input rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
                    {categories.map(category => (
                        <div key={category} className="space-y-1">
                            <h3 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                {category}
                            </h3>
                            {filteredTools.filter(t => t.category === category).map(tool => (
                                <Link
                                    key={tool.id}
                                    to={tool.path}
                                    onClick={onClose}
                                    className={cn(
                                        "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors group",
                                        location.pathname === tool.path
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <tool.icon className={cn("h-4 w-4", location.pathname === tool.path ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                    <span>{tool.title}</span>
                                    {location.pathname === tool.path && (
                                        <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
                                    )}
                                </Link>
                            ))}
                        </div>
                    ))}
                    {filteredTools.length === 0 && (
                        <div className="px-4 text-sm text-muted-foreground text-center py-8">
                            No tools found
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border text-xs text-muted-foreground text-center">
                    Client-side only. Private.
                </div>
            </div>
        </>
    )
}
