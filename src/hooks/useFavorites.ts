import { useState, useEffect } from 'react'

export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>(() => {
        const stored = localStorage.getItem('detools-favorites')
        return stored ? JSON.parse(stored) : []
    })

    useEffect(() => {
        localStorage.setItem('detools-favorites', JSON.stringify(favorites))
    }, [favorites])

    const toggleFavorite = (id: string) => {
        setFavorites(prev =>
            prev.includes(id)
                ? prev.filter(f => f !== id)
                : [...prev, id]
        )
    }

    const isFavorite = (id: string) => favorites.includes(id)

    return { favorites, toggleFavorite, isFavorite }
}
