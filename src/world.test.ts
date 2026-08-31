import { describe, expect, it } from 'vitest'
import {
  WORLD_HEIGHT_VH, WORLD_VIEWPORTS, assetDefinitions, assetProofMarks,
  buildRegistrationSegments, getLocalProofProgress, getMotifState,
  getProofBeatIndex, getProofBlends, hiddenMarks, interpolateProofProfiles,
  proofBeats, registrationPathNodes, textMarks,
} from './world'

describe('the unprinted proof', () => {
  it('covers one exact 2100svh journey with fourteen proofs', () => {
    expect(WORLD_HEIGHT_VH).toBe(2100); expect(WORLD_VIEWPORTS).toBe(21); expect(proofBeats).toHaveLength(14)
    expect(proofBeats[0].start).toBe(0); expect(proofBeats.at(-1)?.end).toBe(1)
    proofBeats.slice(1).forEach((beat, index) => expect(beat.start).toBe(proofBeats[index].end))
  })

  it('keeps the title inside the final impression only', () => {
    expect(new Set(proofBeats.map((beat) => beat.id)).size).toBe(14)
    expect(textMarks.filter((mark) => mark.title)).toHaveLength(1)
    expect(textMarks.find((mark) => mark.title)?.lines[0]).toBe('the unprinted proof')
    expect(proofBeats.at(-1)?.copy.some((mark) => mark.title)).toBe(true)
  })

  it('composes nine transparent sources with explicit mobile placements', () => {
    expect(Object.keys(assetDefinitions)).toHaveLength(9); expect(assetProofMarks.length).toBeGreaterThan(35)
    expect(assetProofMarks.every((mark) => mark.mobile)).toBe(true)
    expect(new Set(assetProofMarks.map((mark) => mark.assetId)).size).toBe(9)
    expect(Object.values(assetDefinitions).every((asset) => asset.source.startsWith('/art/proof/'))).toBe(true)
  })

  it('provides inspectable discarded proofs throughout the wall', () => {
    proofBeats.forEach((beat) => expect(beat.annotations.length).toBeGreaterThanOrEqual(3))
    expect(hiddenMarks).toHaveLength(proofBeats.reduce((sum, beat) => sum + beat.annotations.length, 0))
  })

  it('selects proof boundaries and local progress deterministically', () => {
    expect(getProofBeatIndex(0)).toBe(0); expect(getProofBeatIndex(.09)).toBe(1); expect(getProofBeatIndex(1)).toBe(13)
    expect(getLocalProofProgress(.09, proofBeats[1])).toBeCloseTo(.5)
    expect(getProofBeatIndex(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('blends neighbouring proofs without losing total weight', () => {
    for (const progress of [.01, .08, .17, .28, .5, .7, .86, .96, .999]) {
      const blends = getProofBlends(progress)
      expect(blends.reduce((sum, blend) => sum + blend.weight, 0)).toBeCloseTo(1)
      expect(blends.length).toBeGreaterThan(0)
    }
    expect(getProofBlends(.05).length).toBeGreaterThan(1)
  })

  it('moves from paper into night and dissolves only at the end', () => {
    const paper = interpolateProofProfiles(.1); const depth = interpolateProofProfiles(.78)
    expect(depth.visual.night).toBeGreaterThan(paper.visual.night)
    expect(getMotifState(.989).dissolution).toBe(0)
    expect(getMotifState(.995).dissolution).toBeGreaterThan(0)
    expect(getMotifState(1).dissolution).toBe(1)
  })

  it('builds one continuous, materially changing registration path', () => {
    const segments = buildRegistrationSegments()
    expect(segments).toHaveLength(registrationPathNodes.length - 1)
    expect(segments[0].path).toMatch(/^M /)
    expect(new Set(segments.map((segment) => segment.mode)).size).toBeGreaterThan(8)
    expect(new Set(segments.map((segment) => segment.ink)).size).toBeGreaterThan(3)
  })
})
