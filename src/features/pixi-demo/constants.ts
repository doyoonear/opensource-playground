export const CANVAS_CONFIG = {
    width: 800,
    height: 600,
    backgroundColor: 0x1099bb,
    antialias: true,
} as const

export const BACKGROUND_CONFIG = {
    rect: { x: 100, y: 100, width: 600, height: 400 },
    fillColor: 0xffffff,
    gridColor: 0xcccccc,
    verticalLines: 20,
    horizontalLines: 14,
    lineSpacing: 30,
} as const

export const BUNNY_GRID_CONFIG = {
    columns: 5,
    rows: 5,
    startX: 150,
    startY: 150,
    spacingX: 120,
    spacingY: 80,
    scale: 2,
} as const

export const DISPLACEMENT_CONFIG = {
    canvasSize: 512,
    gradientCenter: 256,
    scale: { x: 50, y: 50 },
    position: { x: 400, y: 300 },
} as const

export const BLUR_CONFIG = {
    strength: 8,
    quality: 4,
} as const
