import { Sprite, Assets, DisplacementFilter, Application } from 'pixi.js'
import { DISPLACEMENT_CONFIG } from '../../constants'
import type { FilterResult } from '../../types'

export async function createDisplacementFilter(
    app: Application,
    signal: AbortSignal
): Promise<FilterResult> {
    const { canvasSize, gradientCenter, scale, position } = DISPLACEMENT_CONFIG

    const canvas = document.createElement('canvas')
    canvas.width = canvasSize
    canvas.height = canvasSize

    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(
        gradientCenter,
        gradientCenter,
        0,
        gradientCenter,
        gradientCenter,
        gradientCenter
    )
    gradient.addColorStop(0, 'rgba(255, 128, 128, 1)')
    gradient.addColorStop(0.5, 'rgba(128, 128, 128, 1)')
    gradient.addColorStop(1, 'rgba(128, 128, 128, 1)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    const texture = await Assets.load({
        src: canvas.toDataURL(),
        loadParser: 'loadTextures',
    })

    if (signal.aborted) {
        return {
            filter: new DisplacementFilter({
                sprite: new Sprite(),
                scale: { x: 0, y: 0 },
            }),
        }
    }

    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.x = position.x
    sprite.y = position.y
    app.stage.addChild(sprite)

    const filter = new DisplacementFilter({ sprite, scale })

    return {
        filter,
        cleanup: () => {
            if (!app.stage || sprite.destroyed) return

            try {
                app.stage.removeChild(sprite)
            } catch {
                // already removed
            }

            if (!sprite.destroyed) {
                sprite.destroy()
            }
        },
    }
}
