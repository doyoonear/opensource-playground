import { Graphics } from 'pixi.js'
import { BACKGROUND_CONFIG } from '../constants'

export function createBackgroundScene(): Graphics {
    const {
        rect,
        fillColor,
        gridColor,
        verticalLines,
        horizontalLines,
        lineSpacing,
    } = BACKGROUND_CONFIG

    const graphics = new Graphics()

    graphics.rect(rect.x, rect.y, rect.width, rect.height)
    graphics.fill({ color: fillColor })

    for (let i = 0; i < verticalLines; i++) {
        graphics.rect(rect.x + i * lineSpacing, rect.y, 1, rect.height)
        graphics.fill({ color: gridColor })
    }

    for (let i = 0; i < horizontalLines; i++) {
        graphics.rect(rect.x, rect.y + i * lineSpacing, rect.width, 1)
        graphics.fill({ color: gridColor })
    }

    return graphics
}
