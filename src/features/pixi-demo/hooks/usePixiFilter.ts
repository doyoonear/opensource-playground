import { useEffect, useRef } from 'react'
import type { UsePixiFilterOptions, FilterResult } from '../types'
import { createDisplacementFilter } from '../factories/filters/createDisplacementFilter'
import { createBlurFilter } from '../factories/filters/createBlurFilter'

export function usePixiFilter(options: UsePixiFilterOptions): void {
    const { filterType, appContext } = options
    const filterResultRef = useRef<FilterResult | null>(null)

    useEffect(() => {
        if (!appContext) return

        const controller = new AbortController()
        const { signal } = controller

        const applyFilter = async () => {
            if (filterResultRef.current?.cleanup) {
                filterResultRef.current.cleanup()
            }

            // eslint-disable-next-line react-hooks/immutability -- PixiJS imperative API
            appContext.container.filters = []

            let result: FilterResult

            if (filterType === 'displacement') {
                result = await createDisplacementFilter(appContext.app, signal)
            } else {
                result = createBlurFilter()
            }

            if (signal.aborted) return

            filterResultRef.current = result
            appContext.container.filters = [result.filter]
        }

        applyFilter()

        return () => {
            controller.abort()
            if (filterResultRef.current?.cleanup) {
                filterResultRef.current.cleanup()
            }
        }
    }, [filterType, appContext])
}
