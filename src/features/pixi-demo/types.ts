import type { Application, Container, Filter } from 'pixi.js'
import type { RefObject } from 'react'

export type FilterType = 'displacement' | 'blur'

export interface PixiAppContext {
    app: Application
    container: Container
    registerCleanup: (cleanup: () => void) => () => void
}

export interface FilterResult {
    filter: Filter
    cleanup?: () => void
}

export interface UsePixiAppOptions {
    mipmapEnabled: boolean
    containerRef: RefObject<HTMLDivElement | null>
}

export interface UsePixiFilterOptions {
    filterType: FilterType
    appContext: PixiAppContext | null
}
