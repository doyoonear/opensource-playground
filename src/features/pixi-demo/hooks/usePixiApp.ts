import { useEffect, useState } from 'react'
import { Application, TextureSource, Assets } from 'pixi.js'
import type { PixiAppContext, UsePixiAppOptions } from '../types'
import { CANVAS_CONFIG } from '../constants'
import { createBackgroundScene } from '../factories/createBackgroundScene'
import { createBunnyGrid } from '../factories/createBunnyGrid'
import bunnyUrl from '../../../assets/bunny.png'

export function usePixiApp(options: UsePixiAppOptions): PixiAppContext | null {
    const { mipmapEnabled, containerRef } = options
    const [appContext, setAppContext] = useState<PixiAppContext | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        const { signal } = controller

        TextureSource.defaultOptions.autoGenerateMipmaps = mipmapEnabled

        const init = async () => {
            const app = new Application()

            await app.init({
                width: CANVAS_CONFIG.width,
                height: CANVAS_CONFIG.height,
                backgroundColor: CANVAS_CONFIG.backgroundColor,
                antialias: CANVAS_CONFIG.antialias,
            })

            if (signal.aborted) {
                app.destroy(true)
                return
            }

            if (!containerRef.current) return
            containerRef.current.innerHTML = ''
            containerRef.current.appendChild(app.canvas)

            const background = createBackgroundScene()
            app.stage.addChild(background)

            const bunnyTexture = await Assets.load(bunnyUrl)

            if (signal.aborted) {
                app.destroy(true)
                return
            }

            const container = createBunnyGrid(bunnyTexture)
            app.stage.addChild(container)

            setAppContext({ app, container })
        }

        init()

        return () => {
            controller.abort()
            setAppContext((prev) => {
                if (prev?.app) {
                    prev.app.destroy(true)
                }
                return null
            })
        }
    }, [mipmapEnabled, containerRef])

    return appContext
}
