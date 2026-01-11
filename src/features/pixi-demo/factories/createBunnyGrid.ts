import { Container, Sprite, Texture } from 'pixi.js'
import { BUNNY_GRID_CONFIG } from '../constants'

export function createBunnyGrid(texture: Texture): Container {
    const { columns, rows, startX, startY, spacingX, spacingY, scale } =
        BUNNY_GRID_CONFIG

    const container = new Container()
    const total = columns * rows

    for (let i = 0; i < total; i++) {
        const bunny = new Sprite(texture)
        bunny.anchor.set(0.5)
        bunny.x = startX + (i % columns) * spacingX
        bunny.y = startY + Math.floor(i / columns) * spacingY
        bunny.scale.set(scale)
        container.addChild(bunny)
    }

    return container
}
