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
        const cleanupRegistry = new Set<() => void>()

        let isDestroyed = false
        let appInstance: Application | null = null

        TextureSource.defaultOptions.autoGenerateMipmaps = mipmapEnabled

        const safeDestroy = () => {
            if (isDestroyed || !appInstance) return
            isDestroyed = true
            try {
                appInstance.destroy(true)
            } catch {
                // ignore destroy errors (already destroyed)
            }
        }

        const init = async () => {
            const app = new Application()
            appInstance = app

            await app.init({
                width: CANVAS_CONFIG.width,
                height: CANVAS_CONFIG.height,
                backgroundColor: CANVAS_CONFIG.backgroundColor,
                antialias: CANVAS_CONFIG.antialias,
            })

            if (signal.aborted) {
                safeDestroy()
                return
            }

            if (!containerRef.current) return
            containerRef.current.innerHTML = ''
            containerRef.current.appendChild(app.canvas)

            const background = createBackgroundScene()
            app.stage.addChild(background)

            const bunnyTexture = await Assets.load(bunnyUrl)

            if (signal.aborted) {
                safeDestroy()
                return
            }

            const container = createBunnyGrid(bunnyTexture)
            app.stage.addChild(container)

            if (signal.aborted) {
                safeDestroy()
                return
            }

            const registerCleanup = (cleanup: () => void): (() => void) => {
                cleanupRegistry.add(cleanup)
                return () => {
                    cleanupRegistry.delete(cleanup)
                }
            }

            setAppContext({ app, container, registerCleanup })
        }

        init()

        return () => {
            controller.abort()

            cleanupRegistry.forEach((cleanup) => {
                try {
                    cleanup()
                } catch {
                    // ignore cleanup errors
                }
            })
            cleanupRegistry.clear()

            safeDestroy()
            setAppContext(null)
        }
    }, [mipmapEnabled, containerRef])

    return appContext
}
