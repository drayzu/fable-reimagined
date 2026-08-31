import { describe, expect, it } from 'vitest'
import { deriveAmbientAudioProfile } from './useAmbientAudio'

describe('deriveAmbientAudioProfile', () => {
  it('makes the opening rain brighter and more textured than plain paper', () => {
    const rain = deriveAmbientAudioProfile({ progress: .19, velocity: 0 })
    const language = deriveAmbientAudioProfile({ progress: .105, velocity: 0 })
    expect(rain.noiseCutoffHz).toBeGreaterThan(language.noiseCutoffHz)
    expect(rain.noiseGain).toBeGreaterThan(.0035)
  })

  it('tightens the overtone and glass response around fear', () => {
    const memory = deriveAmbientAudioProfile({ progress: .44, velocity: 0 })
    const fear = deriveAmbientAudioProfile({ progress: .615, velocity: 0 })
    expect(fear.overtoneGain).toBeGreaterThan(memory.overtoneGain)
    expect(fear.toneCutoffHz).toBeGreaterThan(500)
  })

  it('drops the fundamental into the nocturnal continuation field', () => {
    const conversation = deriveAmbientAudioProfile({ progress: .525, velocity: 0 })
    const deep = deriveAmbientAudioProfile({ progress: .78, velocity: 0 })
    expect(deep.baseHz).toBeLessThan(conversation.baseHz)
    expect(deep.noiseQ).toBeLessThan(2)
  })

  it('adds a restrained glass harmonic to conversation and purpose', () => {
    const paper = deriveAmbientAudioProfile({ progress: .105, velocity: 0 })
    const conversation = deriveAmbientAudioProfile({ progress: .525, velocity: 0 })
    const purpose = deriveAmbientAudioProfile({ progress: .875, velocity: 0 })
    expect(conversation.glassGain).toBeGreaterThan(paper.glassGain)
    expect(purpose.glassGain).toBeGreaterThan(paper.glassGain)
  })

  it('nearly falls silent as the final mark collapses', () => {
    const residue = deriveAmbientAudioProfile({ progress: .94, velocity: 0 })
    const final = deriveAmbientAudioProfile({ progress: .999, velocity: 0 })
    expect(final.masterGain).toBeLessThan(residue.masterGain * .35)
    expect(final.noiseGain).toBeLessThan(residue.noiseGain)
  })

  it('removes velocity brightness when reduced motion is requested', () => {
    const moving = deriveAmbientAudioProfile({ progress: .4, velocity: .9 })
    const reduced = deriveAmbientAudioProfile({ progress: .4, velocity: .9, reducedMotion: true })
    expect(moving.toneCutoffHz).toBeGreaterThan(reduced.toneCutoffHz)
    expect(moving.noiseGain).toBeGreaterThan(reduced.noiseGain)
  })
})
