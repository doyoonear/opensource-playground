# React에서 Imperative 라이브러리 사용 아키텍처

이 문서는 React에서 PixiJS, Three.js, D3.js 같은 imperative 라이브러리를 효과적으로 통합하기 위한 아키텍처 패턴을 설명합니다.

## 목차

1. [문제 상황](#문제-상황)
2. [AbortController 패턴](#abortcontroller-패턴)
3. [Factory 패턴](#factory-패턴)
4. [패턴 조합](#패턴-조합)
5. [파일 구조](#파일-구조)

---

## 문제 상황

### React와 Imperative 라이브러리의 충돌

React는 **선언적(Declarative)** 패러다임을 따르지만, PixiJS 같은 Canvas 라이브러리는 **명령적(Imperative)** API를 사용합니다.

```typescript
// React: 선언적 - "무엇을" 렌더링할지 선언
return <div>{count}</div>

// PixiJS: 명령적 - "어떻게" 렌더링할지 명령
const sprite = new Sprite(texture)
sprite.x = 100
app.stage.addChild(sprite)
```

### 일반적인 문제점

1. **거대한 useEffect**: 초기화 로직이 100줄 이상으로 비대해짐
2. **Race Condition**: 비동기 작업 중 컴포넌트 언마운트 시 에러 발생
3. **불필요한 재초기화**: 관련 없는 상태 변경에도 전체 재생성
4. **테스트 불가**: useEffect 내부 로직은 단위 테스트 어려움

---

## AbortController 패턴

### 개념

`AbortController`는 브라우저 내장 API로, 비동기 작업을 취소할 수 있는 표준 메커니즘입니다.

### 기존 방식의 문제

```typescript
// ❌ 수동 cancelled 플래그 - 누락하기 쉽고 일관성 없음
useEffect(() => {
  let cancelled = false

  const init = async () => {
    const app = new Application()
    await app.init(config)  // 1초 소요

    // 문제: 모든 await 후에 수동으로 체크해야 함
    if (cancelled) return  // 누락 가능!

    await Assets.load(url)  // 또 1초 소요
    if (cancelled) return   // 또 누락 가능!

    // 컴포넌트가 이미 언마운트됐을 수 있음
    setState(app)  // 에러 발생!
  }

  init()
  return () => { cancelled = true }
}, [deps])
```

### AbortController 해결책

```typescript
// ✅ AbortController - 표준화되고 일관된 취소 처리
useEffect(() => {
  const controller = new AbortController()
  const { signal } = controller

  const init = async () => {
    try {
      const app = new Application()
      await app.init(config)

      // 일관된 체크 패턴
      if (signal.aborted) {
        app.destroy(true)
        return
      }

      // fetch API와 네이티브 통합 가능
      const response = await fetch(url, { signal })

      if (signal.aborted) return

      setState(app)
    } catch (error) {
      // AbortError는 정상적인 취소
      if (error.name === 'AbortError') return
      throw error
    }
  }

  init()

  // cleanup에서 abort() 한 번만 호출
  return () => controller.abort()
}, [deps])
```

### 장점

| 특징 | 설명 |
|------|------|
| **표준 API** | 브라우저 내장, 별도 라이브러리 불필요 |
| **일관성** | `signal.aborted`로 어디서든 동일한 체크 |
| **통합** | `fetch`, `addEventListener` 등과 네이티브 통합 |
| **이벤트 기반** | `signal.addEventListener('abort', callback)` 가능 |

### 실제 적용 예시

```typescript
// hooks/usePixiApp.ts
export function usePixiApp({ mipmapEnabled, containerRef }) {
  const [appContext, setAppContext] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const init = async () => {
      const app = new Application()
      await app.init(CANVAS_CONFIG)

      if (signal.aborted) {
        app.destroy(true)
        return
      }

      // DOM 마운트 및 씬 구성
      containerRef.current.appendChild(app.canvas)
      // ...

      setAppContext({ app, container })
    }

    init()

    return () => {
      controller.abort()
      // 상태 기반 정리
    }
  }, [mipmapEnabled])

  return appContext
}
```

---

## Factory 패턴

### 개념

Factory 패턴은 **객체 생성 로직을 별도 함수로 분리**하는 패턴입니다. useEffect 내부의 복잡한 객체 생성 코드를 순수 함수로 추출합니다.

### 기존 방식의 문제

```typescript
// ❌ 모든 생성 로직이 useEffect 안에 혼재
useEffect(() => {
  const init = async () => {
    // 배경 생성 (15줄)
    const bgGraphics = new Graphics()
    bgGraphics.rect(100, 100, 600, 400)
    bgGraphics.fill({ color: 0xffffff })
    for (let i = 0; i < 20; i++) {
      bgGraphics.rect(100 + i * 30, 100, 1, 400)
      bgGraphics.fill({ color: 0xcccccc })
    }
    // ...

    // Bunny 생성 (10줄)
    const container = new Container()
    for (let i = 0; i < 25; i++) {
      const bunny = new Sprite(texture)
      bunny.x = 150 + (i % 5) * 120
      // ...
    }

    // 필터 생성 (30줄)
    if (filterType === 'displacement') {
      const canvas = document.createElement('canvas')
      // ... 복잡한 로직
    }
  }
}, [deps])
```

### Factory 패턴 해결책

```typescript
// ✅ factories/createBackgroundScene.ts
import { Graphics } from 'pixi.js'
import { BACKGROUND_CONFIG } from '../constants'

export function createBackgroundScene(): Graphics {
  const { rect, fillColor, gridColor, verticalLines, lineSpacing } = BACKGROUND_CONFIG

  const graphics = new Graphics()

  // 흰색 배경
  graphics.rect(rect.x, rect.y, rect.width, rect.height)
  graphics.fill({ color: fillColor })

  // 그리드 라인
  for (let i = 0; i < verticalLines; i++) {
    graphics.rect(rect.x + i * lineSpacing, rect.y, 1, rect.height)
    graphics.fill({ color: gridColor })
  }

  return graphics
}
```

```typescript
// ✅ factories/createBunnyGrid.ts
import { Container, Sprite, Texture } from 'pixi.js'
import { BUNNY_GRID_CONFIG } from '../constants'

export function createBunnyGrid(texture: Texture): Container {
  const { columns, rows, startX, startY, spacingX, spacingY, scale } = BUNNY_GRID_CONFIG

  const container = new Container()

  for (let i = 0; i < columns * rows; i++) {
    const bunny = new Sprite(texture)
    bunny.anchor.set(0.5)
    bunny.x = startX + (i % columns) * spacingX
    bunny.y = startY + Math.floor(i / columns) * spacingY
    bunny.scale.set(scale)
    container.addChild(bunny)
  }

  return container
}
```

### 비동기 Factory와 Cleanup

필터처럼 복잡한 객체는 cleanup 함수를 함께 반환합니다:

```typescript
// ✅ factories/filters/createDisplacementFilter.ts
interface FilterResult {
  filter: Filter
  cleanup?: () => void
}

export async function createDisplacementFilter(
  app: Application,
  signal: AbortSignal
): Promise<FilterResult> {
  // 텍스처 생성
  const canvas = document.createElement('canvas')
  // ... gradient 설정

  const texture = await Assets.load({
    src: canvas.toDataURL(),
    loadParser: 'loadTextures',
  })

  if (signal.aborted) {
    return { filter: new DisplacementFilter({ sprite: new Sprite(), scale: { x: 0, y: 0 } }) }
  }

  const sprite = new Sprite(texture)
  app.stage.addChild(sprite)

  const filter = new DisplacementFilter({ sprite, scale: { x: 50, y: 50 } })

  return {
    filter,
    // cleanup: 필터 교체 시 sprite 정리
    cleanup: () => {
      app.stage.removeChild(sprite)
      sprite.destroy()
    },
  }
}
```

### 장점

| 특징 | 설명 |
|------|------|
| **단일 책임** | 각 Factory는 하나의 객체 생성만 담당 |
| **테스트 용이** | 순수 함수라서 독립적으로 테스트 가능 |
| **재사용성** | 다른 컴포넌트에서도 동일한 Factory 사용 가능 |
| **가독성** | useEffect가 "무엇을" 하는지 명확 |
| **타입 안전성** | 입력/출력 타입이 명확하게 정의됨 |

---

## 패턴 조합

### AbortController + Factory 조합

두 패턴을 조합하면 useEffect가 간결하고 안전해집니다:

```typescript
// hooks/usePixiFilter.ts
export function usePixiFilter({ filterType, appContext }) {
  const filterResultRef = useRef<FilterResult | null>(null)

  useEffect(() => {
    if (!appContext) return

    const controller = new AbortController()
    const { signal } = controller

    const applyFilter = async () => {
      // 이전 필터 정리 (Factory의 cleanup 사용)
      filterResultRef.current?.cleanup?.()
      appContext.container.filters = []

      // Factory로 필터 생성 (AbortSignal 전달)
      const result = filterType === 'displacement'
        ? await createDisplacementFilter(appContext.app, signal)
        : createBlurFilter()

      if (signal.aborted) return

      filterResultRef.current = result
      appContext.container.filters = [result.filter]
    }

    applyFilter()

    return () => {
      controller.abort()
      filterResultRef.current?.cleanup?.()
    }
  }, [filterType, appContext])
}
```

### 의존성 분리

핵심 개선: **filterType 변경 시 App 재초기화 방지**

```
Before:
useEffect([mipmapEnabled, filterType]) → 전체 재초기화

After:
usePixiApp([mipmapEnabled])           → App만 재초기화
usePixiFilter([filterType, appContext]) → 필터만 교체
```

---

## 파일 구조

```
src/features/pixi-demo/
├── index.ts                  # Public exports
├── constants.ts              # 매직 숫자 → 명명된 상수
├── types.ts                  # TypeScript 인터페이스
├── hooks/
│   ├── usePixiApp.ts         # App 생명주기 (AbortController)
│   └── usePixiFilter.ts      # 필터 관리 (cleanup 패턴)
├── factories/
│   ├── createBackgroundScene.ts  # 배경 그래픽 Factory
│   ├── createBunnyGrid.ts        # Bunny 컨테이너 Factory
│   └── filters/
│       ├── createBlurFilter.ts         # 동기 Factory
│       └── createDisplacementFilter.ts # 비동기 Factory + cleanup
└── components/
    └── PixiCanvas.tsx        # 훅 조합 컴포넌트
```

### 각 파일의 책임

| 파일 | 책임 |
|------|------|
| `constants.ts` | 설정값 중앙 관리 (테스트/조정 용이) |
| `types.ts` | 타입 안전성, 인터페이스 정의 |
| `usePixiApp.ts` | App 생성/파괴, DOM 마운트 |
| `usePixiFilter.ts` | 필터 교체, 이전 필터 cleanup |
| `factories/*` | 순수 객체 생성 함수 |
| `PixiCanvas.tsx` | 훅 조합, props 전달 |

---

## 요약

| 패턴 | 해결하는 문제 | 핵심 |
|------|-------------|------|
| **AbortController** | Race Condition | 표준 비동기 취소 메커니즘 |
| **Factory** | 거대한 useEffect | 객체 생성 로직 분리 |
| **의존성 분리** | 불필요한 재초기화 | 관심사별 Hook 분리 |
| **Cleanup 반환** | 리소스 누수 | Factory가 cleanup 함수 제공 |

이 패턴들을 조합하면 React에서 imperative 라이브러리를 안전하고 유지보수 가능한 방식으로 통합할 수 있습니다.
