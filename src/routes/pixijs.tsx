import { createFileRoute } from '@tanstack/react-router'
import { useRef, useEffect, useState } from 'react'
import {
    Application,
    Sprite,
    Graphics,
    DisplacementFilter,
    TextureSource,
    BlurFilter,
    Container,
    Assets,
} from 'pixi.js'
import bunnyUrl from '../assets/bunny.png'

export const Route = createFileRoute('/pixijs')({
    component: PixiJSIssuePage,
})

function PixiJSIssuePage() {
    const containerRef = useRef<HTMLDivElement>(null)
    const [mipmapEnabled, setMipmapEnabled] = useState(false)
    const [filterType, setFilterType] = useState<'displacement' | 'blur'>(
        'displacement'
    )

    useEffect(() => {
        if (!containerRef.current) return

        TextureSource.defaultOptions.autoGenerateMipmaps = mipmapEnabled

        let app: Application | null = null
        let cancelled = false

        const init = async () => {
            const newApp = new Application()
            await newApp.init({
                width: 800,
                height: 600,
                backgroundColor: 0x1099bb,
                antialias: true,
            })

            if (cancelled) {
                newApp.destroy(true)
                return
            }

            app = newApp

            if (!containerRef.current) return
            containerRef.current.innerHTML = ''
            containerRef.current.appendChild(app.canvas)

            const bgGraphics = new Graphics()
            bgGraphics.rect(100, 100, 600, 400)
            bgGraphics.fill({ color: 0xffffff })

            for (let i = 0; i < 20; i++) {
                bgGraphics.rect(100 + i * 30, 100, 1, 400)
                bgGraphics.fill({ color: 0xcccccc })
            }
            for (let i = 0; i < 14; i++) {
                bgGraphics.rect(100, 100 + i * 30, 600, 1)
                bgGraphics.fill({ color: 0xcccccc })
            }

            app.stage.addChild(bgGraphics)

            const bunnyTexture = await Assets.load(bunnyUrl)

            if (cancelled) return

            const container = new Container()

            for (let i = 0; i < 25; i++) {
                const bunny = new Sprite(bunnyTexture)
                bunny.anchor.set(0.5)
                bunny.x = 150 + (i % 5) * 120
                bunny.y = 150 + Math.floor(i / 5) * 80
                bunny.scale.set(2)
                container.addChild(bunny)
            }

            app.stage.addChild(container)

            if (filterType === 'displacement') {
                const displacementCanvas = document.createElement('canvas')
                displacementCanvas.width = 512
                displacementCanvas.height = 512
                const ctx = displacementCanvas.getContext('2d')!

                const gradient = ctx.createRadialGradient(
                    256,
                    256,
                    0,
                    256,
                    256,
                    256
                )
                gradient.addColorStop(0, 'rgba(255, 128, 128, 1)')
                gradient.addColorStop(0.5, 'rgba(128, 128, 128, 1)')
                gradient.addColorStop(1, 'rgba(128, 128, 128, 1)')
                ctx.fillStyle = gradient
                ctx.fillRect(0, 0, 512, 512)

                const displacementTexture = await Assets.load({
                    src: displacementCanvas.toDataURL(),
                    loadParser: 'loadTextures',
                })

                if (cancelled) return

                const displacementSprite = new Sprite(displacementTexture)
                displacementSprite.anchor.set(0.5)
                displacementSprite.x = 400
                displacementSprite.y = 300

                app.stage.addChild(displacementSprite)

                const displacementFilter = new DisplacementFilter({
                    sprite: displacementSprite,
                    scale: { x: 50, y: 50 },
                })

                container.filters = [displacementFilter]
            } else {
                const blurFilter = new BlurFilter({
                    strength: 8,
                    quality: 4,
                })
                container.filters = [blurFilter]
            }
        }

        init()

        return () => {
            cancelled = true
            if (app) {
                app.destroy(true)
            }
        }
    }, [mipmapEnabled, filterType])

    return (
        <div className="container">
            <h1>PixiJS Issue #11717 재현 테스트</h1>
            <p className="description">
                autoGenerateMipmaps = true 설정 시 필터 렌더링이 손상되는 이슈
            </p>

            <div className="controls">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={mipmapEnabled}
                        onChange={(e) => setMipmapEnabled(e.target.checked)}
                    />
                    <span>
                        autoGenerateMipmaps: {mipmapEnabled ? 'true' : 'false'}
                    </span>
                    {mipmapEnabled && (
                        <span className="warning">(이슈 발생 조건)</span>
                    )}
                </label>

                <select
                    value={filterType}
                    onChange={(e) =>
                        setFilterType(e.target.value as 'displacement' | 'blur')
                    }
                    className="select"
                >
                    <option value="displacement">DisplacementFilter</option>
                    <option value="blur">BlurFilter</option>
                </select>
            </div>

            <div className="canvas-container">
                <div ref={containerRef} />
            </div>

            <div className="info-box">
                <h3>예상 증상:</h3>
                <ul>
                    <li>
                        autoGenerateMipmaps = false: 필터가 정상적으로 적용됨
                    </li>
                    <li>
                        autoGenerateMipmaps = true: 필터 영역이 손상되거나
                        이상하게 표시됨
                    </li>
                    <li>
                        특히 DisplacementFilter에서 스케일된 UV 샘플링 시 빈
                        밉맵 레벨을 읽어 문제 발생
                    </li>
                </ul>
            </div>
        </div>
    )
}
