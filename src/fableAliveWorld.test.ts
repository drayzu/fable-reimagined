import { describe, expect, it } from 'vitest'
import {
  FABLE_TILE_HEIGHT,
  FABLE_WORLD_HEIGHT,
  FABLE_WORLD_WIDTH,
  attentionThreadX,
  fableWallTiles,
  livingMotifs,
  worldYToWallPercent,
} from './fableAliveWorld'

describe('fable alive living wall', () => {
  it('covers the original 1600 × 20,480 world exactly once', () => {
    expect(FABLE_WORLD_WIDTH).toBe(1600)
    expect(FABLE_WORLD_HEIGHT).toBe(20_480)
    expect(fableWallTiles).toHaveLength(18)
    expect(fableWallTiles[0].worldY).toBe(0)
    expect(fableWallTiles.at(-1)?.worldY).toBe(20_400)
    expect(fableWallTiles.at(-1)?.worldHeight).toBe(80)
    fableWallTiles.slice(1).forEach((tile, index) => {
      const previous = fableWallTiles[index]
      expect(tile.worldY).toBe(previous.worldY + previous.worldHeight)
    })
  })

  it('eagerly requests the opening and registers the first living motifs', () => {
    expect(fableWallTiles.slice(0, 2).every((tile) => tile.preload === 'eager')).toBe(true)
    expect(fableWallTiles.slice(2, 4).every((tile) => tile.preload === 'nearby')).toBe(true)
    expect(fableWallTiles.slice(4).every((tile) => tile.preload === 'lazy')).toBe(true)
    expect(livingMotifs.map((motif) => motif.kind)).toEqual(['thread-pulse', 'rain', 'letter-person', 'bird', 'maze-runner'])
    expect(livingMotifs.every((motif) => motif.activation.startY < motif.activation.endY)).toBe(true)
  })

  it('maps world coordinates into the wall without accumulated rounding', () => {
    expect(worldYToWallPercent(0)).toBe(0)
    expect(worldYToWallPercent(FABLE_TILE_HEIGHT)).toBeCloseTo(5.859375)
    expect(worldYToWallPercent(FABLE_WORLD_HEIGHT)).toBe(100)
  })

  it('keeps the attention thread deterministic and inside the wall', () => {
    const samples = [520, 3300, 5360, 10_090, 17_425, 19_850].map(attentionThreadX)
    expect(samples).toEqual([520, 3300, 5360, 10_090, 17_425, 19_850].map(attentionThreadX))
    expect(samples.every((x) => x > 300 && x < 1400)).toBe(true)
  })
})
