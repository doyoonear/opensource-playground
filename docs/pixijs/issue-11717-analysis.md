# PixiJS Issue #11717 분석

> `autoGenerateMipmaps = true` 설정 시 필터 렌더링이 손상되는 이슈

**GitHub Issue:** https://github.com/pixijs/pixijs/issues/11717

---

## 원인 1: 단계별 코드 추적

### Step 1: 전역 설정 변경

```typescript
// 사용자가 설정하는 코드
TextureSource.defaultOptions.autoGenerateMipmaps = true
```

**파일:** `TextureSource.ts:92-102`

```typescript
public static defaultOptions: TextureSourceOptions = {
    resolution: 1,
    format: 'bgra8unorm',
    // ...
    autoGenerateMipmaps: false,  // ← 기본값은 false
    // ...
};
```

이 설정을 `true`로 바꾸면 이후 생성되는 **모든 TextureSource**가 영향을 받습니다.

---

### Step 2: FilterSystem이 TexturePool에서 텍스처 요청

**파일:** `FilterSystem.ts:350, 618`

```typescript
// 필터 적용 시 TexturePool에서 임시 텍스처 획득
filterData.outputRenderSurface = TexturePool.getOptimalTexture(
    bounds.width,
    bounds.height,
    filterData.resolution,
    antialias
);

filterData.inputTexture = TexturePool.getOptimalTexture(
    bounds.width,
    bounds.height,
    filterData.resolution,
    antialias
);
```

---

### Step 3: TexturePool이 텍스처 생성

**파일:** `TexturePool.ts:99-104`

```typescript
public getOptimalTexture(...): Texture {
    // 풀에서 재사용 가능한 텍스처 찾기
    let texture = this._texturePool[key].pop();

    // 없으면 새로 생성
    if (!texture) {
        texture = this.createTexture(po2Width, po2Height, antialias);
    }
    // ...
}
```

**파일:** `TexturePool.ts:58-74` - `createTexture` 메서드

```typescript
public createTexture(pixelWidth: number, pixelHeight: number, antialias: boolean): Texture
{
    const textureSource = new TextureSource({
        ...this.textureOptions,  // ← 여기서 옵션 전파
        width: pixelWidth,
        height: pixelHeight,
        resolution: 1,
        antialias,
        autoGarbageCollect: false,
    });

    return new Texture({
        source: textureSource,
        label: `texturePool_${count++}`,
    });
}
```

> **핵심 포인트:** `this.textureOptions`에는 `autoGenerateMipmaps`가 명시적으로 설정되어 있지 않습니다.
> 따라서 TextureSource 생성자에서 `defaultOptions`가 적용됩니다!

---

### Step 4: TextureSource 생성자에서 defaultOptions 적용

TextureSource 생성자는 다음과 같이 동작합니다 (코드에서 유추):

```typescript
constructor(options: TextureSourceOptions = {}) {
    options = { ...TextureSource.defaultOptions, ...options };
    //              ↑ defaultOptions가 먼저 적용됨!

    this.autoGenerateMipmaps = options.autoGenerateMipmaps;
    // ...
}
```

**결과:**
- `TextureSource.defaultOptions.autoGenerateMipmaps = true`가 설정되어 있으면
- TexturePool이 생성하는 **모든 임시 텍스처**에 `autoGenerateMipmaps = true`가 적용됨

---

### Step 5: GPU 텍스처 초기화 시 mipLevelCount 계산

**파일:** `GpuTextureSystem.ts:110-117`

```typescript
private _initSource(source: TextureSource): GPUTexture
{
    // autoGenerateMipmaps가 true면 밉맵 레벨 수 계산
    if (source.autoGenerateMipmaps)
    {
        const biggestDimension = Math.max(source.pixelWidth, source.pixelHeight);

        // 예: 512x512 → log2(512) + 1 = 10 레벨
        source.mipLevelCount = Math.floor(Math.log2(biggestDimension)) + 1;
    }

    // GPU 텍스처 생성 (mipLevelCount 포함)
    const textureDescriptor: GPUTextureDescriptor = {
        // ...
        mipLevelCount: source.mipLevelCount,  // ← 10 레벨로 생성됨
        // ...
    };

    const gpuTexture = this._gpu.device.createTexture(textureDescriptor);
    // ...
}
```

**결과:**
- 512x512 텍스처라면 **10개의 밉맵 레벨**이 할당됨
- 레벨 0: 512x512, 레벨 1: 256x256, ..., 레벨 9: 1x1

---

### Step 6: 텍스처 업데이트 시 밉맵 생성 조건

**파일:** `GpuTextureSystem.ts:160-176`

```typescript
protected onSourceUpdate(source: TextureSource): void
{
    const gpuTexture = this.getGpuSource(source);
    if (!gpuTexture) return;

    // 리소스가 있으면 업로드
    if (this._uploads[source.uploadMethodId])
    {
        this._uploads[source.uploadMethodId].upload(source, gpuTexture, this._gpu);
    }

    // 밉맵 자동 생성 조건
    if (source.autoGenerateMipmaps && source.mipLevelCount > 1)
    {
        this.onUpdateMipmaps(source);  // ← 밉맵 생성
    }
}
```

> **여기서 문제 발생!**
> - `onSourceUpdate`는 `source.emit('update')` 이벤트가 발생할 때만 호출됨
> - TexturePool의 렌더 텍스처는 **이미지 리소스가 아님** (렌더 타겟)
> - 필터가 이 텍스처에 **렌더링**해도 `update` 이벤트가 발생하지 않음!

---

### Step 7: 필터 렌더링 후 밉맵이 업데이트되지 않음

FilterSystem에서 텍스처에 렌더링하는 흐름:

```typescript
// FilterSystem 내부 (간략화)
const outputTexture = TexturePool.getOptimalTexture(...);

// GPU에 렌더링 명령 전송
renderer.encoder.draw(...);  // outputTexture에 렌더링됨

// ❌ 여기서 밉맵 업데이트가 호출되지 않음!
// outputTexture.source.emit('update') 또는
// outputTexture.source.updateMipmaps() 가 없음!
```

**결과:**
- GPU 텍스처의 **레벨 0 (512x512)** 에만 렌더링 데이터가 있음
- **레벨 1~9는 초기화되지 않은 가비지 데이터**

---

### Step 8: 다음 필터가 스케일된 UV로 샘플링

DisplacementFilter 셰이더 예시:

```glsl
// displacement.frag
void main()
{
    vec4 map = texture(uMapTexture, vFilterUv);

    // 오프셋 계산 (회전 + 스케일)
    vec2 offset = uInputSize.zw * (uRotation * (map.xy - 0.5)) * uScale;

    // 스케일된 UV로 샘플링
    finalColor = texture(uTexture, vTextureCoord + offset);
    //                    ↑ GPU가 자동으로 밉맵 레벨 선택
}
```

**GPU의 밉맵 레벨 선택:**
- GPU는 `texture()` 함수 호출 시 UV 좌표의 미분값(derivatives)을 계산
- 이를 기반으로 적절한 밉맵 레벨을 자동 선택
- `offset`이 적용된 UV는 미분값이 커질 수 있음 → 높은 밉맵 레벨 선택

**결과:**
- GPU가 레벨 1, 2, ... 등을 샘플링
- 해당 레벨에는 **가비지 데이터**만 있음
- → **이미지 손상!**

---

## 전체 흐름 요약

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TextureSource.defaultOptions.autoGenerateMipmaps = true  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FilterSystem → TexturePool.getOptimalTexture()           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TexturePool.createTexture() → new TextureSource()        │
│    - defaultOptions가 적용됨 → autoGenerateMipmaps = true   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. GpuTextureSystem._initSource()                           │
│    - mipLevelCount = 10 (512x512 기준)                      │
│    - GPU 텍스처 생성 (10레벨)                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 필터가 텍스처에 렌더링                                    │
│    - 레벨 0에만 데이터 기록                                  │
│    ❌ updateMipmaps() 호출 없음!                            │
│    - 레벨 1~9는 가비지 상태                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 다음 필터가 texture() 샘플링                              │
│    - GPU가 자동으로 밉맵 레벨 선택                           │
│    - 가비지 레벨에서 샘플링 → 이미지 손상!                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 해결 방향

| 방법 | 설명 | 비고 |
|------|------|------|
| **1. TexturePool에서 명시적 설정** | `autoGenerateMipmaps: false`를 TexturePool.createTexture()에 추가 | 가장 간단 |
| **2. FilterSystem에서 밉맵 업데이트** | 렌더링 후 `updateMipmaps()` 호출 | 성능 비용 있음 |
| **3. 구조적 분리** | `TextureSource.defaultOptions`가 TexturePool에 영향 못 미치게 분리 | 구조적 변경 필요 |

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/rendering/renderers/shared/texture/TexturePool.ts` | 필터용 임시 텍스처 풀 관리 |
| `src/rendering/renderers/shared/texture/sources/TextureSource.ts` | 텍스처 소스, defaultOptions 정의 |
| `src/rendering/renderers/gpu/texture/GpuTextureSystem.ts` | WebGPU 텍스처 시스템, 밉맵 생성 |
| `src/filters/FilterSystem.ts` | 필터 렌더링 파이프라인 |

---

## 테스트 환경

- `/pixijs` 라우트에서 이슈 재현 테스트 가능
- `autoGenerateMipmaps` 토글로 ON/OFF 비교
- DisplacementFilter, BlurFilter 선택 가능
