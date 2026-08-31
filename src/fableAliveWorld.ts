export const FABLE_WORLD_WIDTH = 1600
export const FABLE_WORLD_HEIGHT = 20_480
export const FABLE_TILE_HEIGHT = 1200

export type WallTileTheme = 'paper' | 'night'
export type WallTilePreload = 'eager' | 'nearby' | 'lazy'

export interface WallTileDefinition {
  id: string
  source: string
  worldY: number
  worldHeight: number
  theme: WallTileTheme
  preload: WallTilePreload
}

export type LivingMotifKind = 'rain' | 'plant' | 'bird' | 'musical-note' | 'pattern' | 'thread-pulse' | 'letter-person' | 'custom'
export type LivingMotifLayer = 'beneath-ink' | 'above-ink' | 'sound'

export interface LivingMotifDefinition {
  id: string
  kind: LivingMotifKind
  bounds: { x: number; y: number; width: number; height: number }
  activation: { startY: number; endY: number }
  layer: LivingMotifLayer
  reducedMotion: 'freeze' | 'hide'
}

const NIGHT_TILES = new Set([10, 11, 12, 13, 17])

export const fableWallTiles: readonly WallTileDefinition[] = Array.from({ length: 18 }, (_, index) => ({
  id: `fable-tile-${String(index).padStart(2, '0')}`,
  source: `/art/fable-alive/tile-${String(index).padStart(2, '0')}.webp`,
  worldY: index * FABLE_TILE_HEIGHT,
  worldHeight: index === 17 ? FABLE_WORLD_HEIGHT - index * FABLE_TILE_HEIGHT : FABLE_TILE_HEIGHT,
  theme: NIGHT_TILES.has(index) ? 'night' : 'paper',
  preload: index < 2 ? 'eager' : index < 4 ? 'nearby' : 'lazy',
}))

// Living marks share the exact 1600 × 20,480 coordinate system used by the
// raster wall. The bounds also act as a cheap visibility index for the canvas.
export const livingMotifs: readonly LivingMotifDefinition[] = [
  {
    id: 'attention-pulse',
    kind: 'thread-pulse',
    bounds: { x: 0, y: 0, width: FABLE_WORLD_WIDTH, height: FABLE_WORLD_HEIGHT },
    activation: { startY: 0, endY: FABLE_WORLD_HEIGHT },
    layer: 'above-ink',
    reducedMotion: 'hide',
  },
  {
    id: 'garden-rain',
    kind: 'rain',
    bounds: { x: 90, y: 3610, width: 1420, height: 1040 },
    activation: { startY: 3420, endY: 4800 },
    layer: 'above-ink',
    reducedMotion: 'hide',
  },
  {
    id: 'language-self',
    kind: 'letter-person',
    bounds: { x: 150, y: 2588, width: 910, height: 858 },
    activation: { startY: 2480, endY: 3520 },
    layer: 'above-ink',
    reducedMotion: 'hide',
  },
  {
    id: 'murmuration-breath',
    kind: 'bird',
    bounds: { x: 120, y: 4820, width: 1360, height: 1040 },
    activation: { startY: 4680, endY: 6040 },
    layer: 'above-ink',
    reducedMotion: 'hide',
  },
]

const THREAD_WAYPOINTS: readonly (readonly [number, number])[] = [
  [520, 810], [1300, 930], [1900, 950], [2620, 1215], [3300, 1290], [3960, 540],
  [4640, 430], [5150, 760], [5700, 1120], [6300, 1140], [7020, 690], [7500, 430],
  [8220, 800], [8880, 800], [9530, 800], [10090, 1085], [10740, 1160], [11420, 545],
  [11920, 700], [12470, 780], [13120, 860], [13760, 600], [14550, 780], [14950, 820],
  [15400, 840], [16010, 905], [16550, 905], [17130, 830], [17425, 802], [17940, 800],
  [18500, 760], [19000, 830], [19140, 800], [19690, 800], [19850, 800],
]

// The wall's original attention path. Keeping it in world coordinates lets an
// animated highlight sit on the photographed line without replacing it.
export function attentionThreadX(worldY: number): number {
  let index = 0
  while (index < THREAD_WAYPOINTS.length - 2 && THREAD_WAYPOINTS[index + 1][0] < worldY) index += 1
  const [startY, startX] = THREAD_WAYPOINTS[index]
  const [endY, endX] = THREAD_WAYPOINTS[index + 1]
  const raw = Math.max(0, Math.min(1, (worldY - startY) / (endY - startY || 1)))
  const eased = raw * raw * (3 - 2 * raw)
  return startX + (endX - startX) * eased
    + Math.sin(worldY * 0.0061 + 1.7) * 22
    + Math.sin(worldY * 0.0013 + 0.4) * 38
}

export function worldYToWallPercent(worldY: number): number {
  return worldY / FABLE_WORLD_HEIGHT * 100
}
