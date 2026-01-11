import { useRef } from 'react'
import type { FilterType } from '../types'
import { usePixiApp } from '../hooks/usePixiApp'
import { usePixiFilter } from '../hooks/usePixiFilter'

interface PixiCanvasProps {
    mipmapEnabled: boolean
    filterType: FilterType
}

export function PixiCanvas({ mipmapEnabled, filterType }: PixiCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null)

    const appContext = usePixiApp({ mipmapEnabled, containerRef })
    usePixiFilter({ filterType, appContext })

    return <div ref={containerRef} />
}
