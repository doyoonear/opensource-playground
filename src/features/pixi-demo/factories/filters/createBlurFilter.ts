import { BlurFilter } from 'pixi.js'
import { BLUR_CONFIG } from '../../constants'
import type { FilterResult } from '../../types'

export function createBlurFilter(): FilterResult {
    const filter = new BlurFilter({
        strength: BLUR_CONFIG.strength,
        quality: BLUR_CONFIG.quality,
    })

    return { filter }
}
