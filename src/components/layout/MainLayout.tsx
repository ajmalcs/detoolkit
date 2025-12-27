import { Outlet, Link } from 'react-router-dom'
import { Menu, House } from 'lucide-react'
import { useState } from 'react'
import { ModeToggle } from '../mode-toggle'
import { Sidebar } from './Sidebar'
import { Button } from '../ui/button'

export function MainLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    return (
        <div className="min-h-screen bg-background font-sans antialiased flex flex-col">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center justify-between w-full max-w-6xl mx-auto px-4 md:px-6">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mr-2 md:hidden"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hidden md:flex mr-2"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>

                        <Link to="/">
                            <Button variant="ghost" size="icon" title="Home">
                                <House className="h-5 w-5" />
                                <span className="sr-only">Home</span>
                            </Button>
                        </Link>

                        <Link to="/" className="flex items-center gap-2 font-bold ml-2">
                            <img src="/logo.png" alt="DEtools" className="h-8 w-auto hidden sm:block" />
                        </Link>
                    </div>

                    <ModeToggle />
                </div>
            </header>
            <main className="flex-1 w-full relative flex flex-col overflow-hidden">
                <Outlet />
            </main>
            <footer className="py-2 px-4 border-t text-center text-xs text-muted-foreground bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                Created by <span className="font-semibold text-foreground">ajmal.cs</span>
            </footer>
        </div>
    )
}
