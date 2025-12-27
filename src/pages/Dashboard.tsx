import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'
import { SearchDialog, tools } from '../components/dashboard/SearchDialog'
import { useFavorites } from '../hooks/useFavorites'

export default function Dashboard() {
    const { isFavorite, toggleFavorite } = useFavorites()

    // Group tools by category
    const categories = Array.from(new Set(tools.map(t => t.category)))

    const pinnedTools = tools.filter(t => isFavorite(t.id))

    return (
        <div className="h-full flex flex-col p-4 gap-6 max-w-7xl mx-auto w-full">
            {/* Header & Search */}
            {/* Header & Search */}
            <div className="flex flex-col gap-6 items-center text-center py-8">
                <img src="/logo.png" alt="DEtools" className="h-16 w-auto" />
                <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Client-side utilities for modern data engineering. No data leaves your browser.
                    </p>
                </div>
                <div className="w-full max-w-md">
                    <SearchDialog />
                </div>
            </div>

            {/* Favorites Section */}
            {pinnedTools.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> Favorites
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {pinnedTools.map(tool => (
                            <ToolCard
                                key={tool.id}
                                tool={tool}
                                isFav={true}
                                onToggleFav={() => toggleFavorite(tool.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* All Tools by Category */}
            <div className="space-y-6">
                {categories.map(category => {
                    const categoryTools = tools.filter(t => t.category === category)
                    if (categoryTools.length === 0) return null

                    return (
                        <div key={category} className="space-y-3">
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">
                                {category}
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {categoryTools.map(tool => (
                                    <ToolCard
                                        key={tool.id}
                                        tool={tool}
                                        isFav={isFavorite(tool.id)}
                                        onToggleFav={() => toggleFavorite(tool.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function ToolCard({ tool, isFav, onToggleFav }: { tool: typeof tools[0], isFav: boolean, onToggleFav: (e: React.MouseEvent) => void }) {
    return (
        <Link
            to={tool.path}
            className="group relative flex flex-col p-3 gap-2 rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow hover:border-primary/30 hover:bg-accent/5 h-full"
        >
            <div className="flex items-start justify-between">
                <div className="p-1.5 w-fit rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <tool.icon className="h-4 w-4" />
                </div>
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        onToggleFav(e)
                    }}
                    className={cn(
                        "p-1 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100",
                        isFav ? "opacity-100 text-yellow-500 hover:bg-yellow-500/10" : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <Star className={cn("h-3 w-3", isFav && "fill-current")} />
                </button>
            </div>

            <div className="space-y-0.5">
                <h3 className="font-semibold text-sm leading-none tracking-tight">{tool.title}</h3>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">{tool.description}</p>
            </div>
        </Link>
    )
}
