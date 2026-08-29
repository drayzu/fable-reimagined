import { describe, expect, it } from 'vitest'
import {
  advanceMaxRevealY,
  createSeededRandom,
  documentToWorldY,
  getVisibleWorldRange,
  isWorldRangeVisible,
  noise1D,
  randomAt,
  revealCandidateY,
  sampleOrganicSignal,
  viewportToWorldY,
  worldRangeVisibility,
  worldToDocumentY,
  worldToViewportY,
  type WorldTransform,
} from './worldGeometry'

const transform: WorldTransform = {
  worldHeight: 21_000,
  documentHeight: 18_000,
  viewportHeight: 900,
  scrollY: 4_500,
}

describe('seeded geometry', () => {
  it('produces repeatable stateful and stateless sequences', () => {
    const first = createSeededRandom('the-interval')
    const second = createSeededRandom('the-interval')
    const sequence = Array.from({ length: 8 }, () => first())

    expect(sequence).toEqual(Array.from({ length: 8 }, () => second()))
    expect(randomAt('the-interval', 12)).toBe(randomAt('the-interval', 12))
    expect(randomAt('the-interval', 12)).not.toBe(randomAt('the-interval', 13))
  })

  it('keeps value noise and organic signals continuous', () => {
    const left = noise1D(8.999_99, 77)
    const right = noise1D(9.000_01, 77)
    expect(Math.abs(right - left)).toBeLessThan(0.001)

    const options = {
      seed: 'copper-signal',
      baseX: 420,
      amplitude: 90,
      wavelength: 680,
    }
    const a = sampleOrganicSignal(3_200, options)
    const b = sampleOrganicSignal(3_200.1, options)

    expect(a).toEqual(sampleOrganicSignal(3_200, options))
    expect(Math.abs(b.x - a.x)).toBeLessThan(1)
    expect(Number.isFinite(a.tangentX)).toBe(true)
  })
})

describe('world camera transforms', () => {
  it('round-trips world and document coordinates', () => {
    const worldY = 7_350
    const documentY = worldToDocumentY(worldY, transform)

    expect(documentToWorldY(documentY, transform)).toBeCloseTo(worldY, 8)
    expect(viewportToWorldY(worldToViewportY(worldY, transform), transform)).toBeCloseTo(worldY, 8)
  })

  it('calculates visible ranges and overlap without scene boundaries', () => {
    const visible = getVisibleWorldRange(transform)

    expect(visible.start).toBe(viewportToWorldY(0, transform))
    expect(visible.end).toBe(viewportToWorldY(900, transform))
    expect(isWorldRangeVisible({ start: visible.start - 100, end: visible.start + 100 }, transform)).toBe(true)
    expect(isWorldRangeVisible({ start: visible.end + 1, end: visible.end + 100 }, transform)).toBe(false)
    expect(worldRangeVisibility({ start: visible.start, end: visible.end }, transform)).toBe(1)
  })
})

describe('persistent reveal', () => {
  it('advances at the reveal line and never retreats', () => {
    const firstCandidate = revealCandidateY(transform)
    const advanced = advanceMaxRevealY(0, firstCandidate, transform.worldHeight)
    const scrolledUp = { ...transform, scrollY: 2_000 }
    const earlierCandidate = revealCandidateY(scrolledUp)

    expect(advanced).toBe(firstCandidate)
    expect(earlierCandidate).toBeLessThan(firstCandidate)
    expect(advanceMaxRevealY(advanced, earlierCandidate, transform.worldHeight)).toBe(advanced)
    expect(advanceMaxRevealY(advanced, 99_999, transform.worldHeight)).toBe(transform.worldHeight)
  })
})
