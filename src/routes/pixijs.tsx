import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { PixiCanvas, type FilterType } from '../features/pixi-demo'

export const Route = createFileRoute('/pixijs')({
    component: PixiJSIssuePage,
})

function PixiJSIssuePage() {
    const [mipmapEnabled, setMipmapEnabled] = useState(false)
    const [filterType, setFilterType] = useState<FilterType>('displacement')

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
                        setFilterType(e.target.value as FilterType)
                    }
                    className="select"
                >
                    <option value="displacement">DisplacementFilter</option>
                    <option value="blur">BlurFilter</option>
                </select>
            </div>

            <div className="canvas-container">
                <PixiCanvas
                    mipmapEnabled={mipmapEnabled}
                    filterType={filterType}
                />
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
