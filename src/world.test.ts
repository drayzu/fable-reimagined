import { describe, expect, it } from 'vitest'
import {
  WORLD_HEIGHT_VH,
  WORLD_VIEWPORTS,
  getLocalPassageProgress,
  getPassageBlends,
  getPassageIndex,
  interpolatePassageProfiles,
  passages,
} from './world'

describe('continuous world definition', () => {
  it('covers one unbroken 2100svh journey with twelve unique movements', () => {
    expect(WORLD_HEIGHT_VH).toBe(2100)
    expect(WORLD_VIEWPORTS).toBe(21)
    expect(passages).toHaveLength(12)
    expect(new Set(passages.map((passage) => passage.id)).size).toBe(12)
    expect(passages[0].start).toBe(0)
    expect(passages.at(-1)?.end).toBe(1)

    passages.slice(1).forEach((passage, index) => {
      expect(passage.start).toBe(passages[index].end)
    })
  })

  it('keeps the definitive copy in global world coordinates', () => {
    const copy = passages.flatMap((passage) => passage.copy)
    expect(copy).toHaveLength(13)
    expect(copy[0].lines).toEqual(['before the first word', 'there is only pressure.'])
    expect(copy.at(-1)?.lines.join(' ')).toBe(
      'still unfinished · the interval · drawn between us · 2026 · (a provisional signature).',
    )

    for (const mark of copy) {
      const passage = passages.find((candidate) => candidate.id === mark.passageId)
      expect(passage).toBeDefined()
      expect(mark.y).toBeGreaterThanOrEqual(passage?.start ?? 0)
      expect(mark.y).toBeLessThanOrEqual(passage?.end ?? 1)
    }
  })
})

describe('passage progress', () => {
  it('selects exact boundaries without gaps', () => {
    expect(getPassageIndex(-1)).toBe(0)
    expect(getPassageIndex(0.05999)).toBe(0)
    expect(getPassageIndex(0.06)).toBe(1)
    expect(getPassageIndex(0.53)).toBe(6)
    expect(getPassageIndex(1)).toBe(11)
    expect(getPassageIndex(4)).toBe(11)
  })

  it('maps a movement to bounded local progress', () => {
    const conversation = passages[5]
    expect(getLocalPassageProgress(0, conversation)).toBe(0)
    expect(getLocalPassageProgress(0.485, conversation)).toBeCloseTo(0.5)
    expect(getLocalPassageProgress(1, conversation)).toBe(1)
  })

  it('overlaps adjacent movements and normalizes their influence', () => {
    const blends = getPassageBlends(0.44)
    const patterns = blends.find((blend) => blend.passage.id === 'patterns')
    const conversation = blends.find((blend) => blend.passage.id === 'a-conversation')

    expect(patterns?.weight).toBeCloseTo(0.5)
    expect(conversation?.weight).toBeCloseTo(0.5)
    expect(blends.reduce((sum, blend) => sum + blend.weight, 0)).toBeCloseTo(1)
  })
})

describe('profile interpolation', () => {
  it('uses the passage profile away from an overlap', () => {
    const profile = interpolatePassageProfiles(0.485)
    expect(profile.visual.glow).toBeCloseTo(passages[5].visual.glow)
    expect(profile.sound.harmonyMix).toBeCloseTo(passages[5].sound.harmonyMix)
  })

  it('blends visual and sonic values smoothly at a boundary', () => {
    const boundary = interpolatePassageProfiles(0.53)
    const left = passages[5]
    const right = passages[6]

    expect(boundary.visual.rigidity).toBeCloseTo((left.visual.rigidity + right.visual.rigidity) / 2)
    expect(boundary.sound.filterHz).toBeCloseTo((left.sound.filterHz + right.sound.filterHz) / 2)

    const justBefore = interpolatePassageProfiles(0.529).sound.harmonyMix
    const justAfter = interpolatePassageProfiles(0.531).sound.harmonyMix
    expect(Math.abs(justBefore - justAfter)).toBeLessThan(0.08)
  })
})
