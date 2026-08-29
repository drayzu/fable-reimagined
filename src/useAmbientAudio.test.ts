import { describe, expect, it } from 'vitest'
import { deriveAmbientAudioProfile } from './useAmbientAudio'

describe('deriveAmbientAudioProfile', () => {
  it('brings in the third voice during conversation and purpose', () => {
    const quiet = deriveAmbientAudioProfile({ progress: 0.12, velocity: 0 })
    const conversation = deriveAmbientAudioProfile({ progress: 0.485, velocity: 0 })
    const purpose = deriveAmbientAudioProfile({ progress: 0.835, velocity: 0 })

    expect(conversation.harmonyGain).toBeGreaterThan(quiet.harmonyGain * 10)
    expect(purpose.harmonyGain).toBeGreaterThan(quiet.harmonyGain * 10)
  })

  it('darkens and raises the noise bed through erasure and depth', () => {
    const paper = deriveAmbientAudioProfile({ progress: 0.1, velocity: 0 })
    const erasure = deriveAmbientAudioProfile({ progress: 0.665, velocity: 0 })
    const deep = deriveAmbientAudioProfile({ progress: 0.745, velocity: 0 })

    expect(erasure.noiseGain).toBeGreaterThan(paper.noiseGain)
    expect(deep.noiseGain).toBeGreaterThan(paper.noiseGain)
    expect(deep.noiseCutoffHz).toBeLessThan(erasure.noiseCutoffHz)
  })

  it('lets callers override chapter weights and clamps unstable input', () => {
    const profile = deriveAmbientAudioProfile({
      progress: Number.POSITIVE_INFINITY,
      velocity: -9,
      weights: { contact: 4, paper: -2 },
    })

    expect(profile.harmonyGain).toBeGreaterThan(0.05)
    expect(profile.noiseGain).toBeLessThan(0.005)
    expect(Number.isFinite(profile.copperHz)).toBe(true)
  })

  it('removes velocity brightness when reduced motion is requested', () => {
    const moving = deriveAmbientAudioProfile({ progress: 0.4, velocity: 0.9 })
    const reduced = deriveAmbientAudioProfile({
      progress: 0.4,
      velocity: 0.9,
      reducedMotion: true,
    })

    expect(moving.toneCutoffHz).toBeGreaterThan(reduced.toneCutoffHz)
    expect(moving.noiseGain).toBeGreaterThan(reduced.noiseGain)
  })
})
