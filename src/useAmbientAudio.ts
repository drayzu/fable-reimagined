import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { clamp01, interpolateProofProfiles, type WorldFrame } from './world'

export interface AmbientAudioSnapshot {
  progress: number
  velocity: number
  reducedMotion?: boolean
}
export interface AmbientAudioProfile {
  baseHz: number
  overtoneHz: number
  glassHz: number
  baseGain: number
  overtoneGain: number
  glassGain: number
  toneCutoffHz: number
  noiseCutoffHz: number
  noiseGain: number
  noiseQ: number
  masterGain: number
}
function finite(value: number, fallback = 0): number { return Number.isFinite(value) ? value : fallback }

export function deriveAmbientAudioProfile(snapshot: AmbientAudioSnapshot): AmbientAudioProfile {
  const progress = clamp01(finite(snapshot.progress))
  const velocity = snapshot.reducedMotion ? 0 : clamp01(Math.abs(finite(snapshot.velocity)))
  const source = interpolateProofProfiles(progress).sound
  const finalFade = progress > .99 ? 1 - clamp01((progress - .99) / .01) : 1
  const texture = source.rain * .75 + source.graphite * .38 + source.air * .48
  return {
    baseHz: source.toneHz,
    overtoneHz: source.toneHz * (1.49 + source.tension * .14),
    glassHz: source.toneHz * (3.2 + source.glass * 1.35),
    baseGain: (.095 + source.air * .035) * finalFade,
    overtoneGain: (.012 + source.tension * .085 + source.graphite * .016) * finalFade,
    glassGain: (.001 + source.glass * .065) * finalFade,
    toneCutoffHz: 380 + source.glass * 2100 + source.tension * 720 + velocity * 900,
    noiseCutoffHz: 180 + source.rain * 3200 + source.graphite * 760 + source.air * 180,
    noiseGain: (.0012 + texture * .009 + velocity * .004) * finalFade,
    noiseQ: .42 + source.glass * 2.2 + source.tension * .8,
    masterGain: source.level * .17 * finalFade,
  }
}

const TRACK_SOURCE = `${import.meta.env.BASE_URL}audio/swarm-instrumental.ogg`
const TRACK_VOLUME = .36
const FADE_DURATION = 1100

export function useAmbientAudio(source: MutableRefObject<WorldFrame>) {
  const [enabled, setEnabled] = useState(false)
  const [supported] = useState(() => typeof Audio !== 'undefined')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const filterRef = useRef<BiquadFilterNode | null>(null)
  const sceneGainRef = useRef<GainNode | null>(null)
  const gateGainRef = useRef<GainNode | null>(null)
  const fadeRef = useRef<number | null>(null)
  const enabledRef = useRef(false)
  void source

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current
    const audio = new Audio(TRACK_SOURCE)
    audio.loop = true
    audio.preload = 'metadata'
    audio.volume = 1
    audioRef.current = audio
    return audio
  }, [])

  const ensureGraph = useCallback((audio: HTMLAudioElement) => {
    if (contextRef.current && gateGainRef.current) return contextRef.current
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return null
    const context = new AudioContextClass(); const media = context.createMediaElementSource(audio)
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = .6
    const sceneGain = context.createGain(); sceneGain.gain.value = TRACK_VOLUME
    const gateGain = context.createGain(); gateGain.gain.value = 0
    media.connect(filter).connect(sceneGain).connect(gateGain).connect(context.destination)
    contextRef.current = context; filterRef.current = filter; sceneGainRef.current = sceneGain; gateGainRef.current = gateGain
    return context
  }, [])

  const fadeTo = useCallback((target: number, onComplete?: () => void) => {
    if (fadeRef.current !== null) window.cancelAnimationFrame(fadeRef.current)
    const gate = gateGainRef.current; const audio = audioRef.current; const initial = gate?.gain.value ?? audio?.volume ?? 0
    const started = performance.now()
    const frame = (now: number) => {
      const progress = clamp01((now - started) / FADE_DURATION)
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = initial + (target - initial) * eased
      if (gate) gate.gain.value = value
      else if (audio) audio.volume = value
      if (progress < 1) fadeRef.current = window.requestAnimationFrame(frame)
      else { fadeRef.current = null; onComplete?.() }
    }
    fadeRef.current = window.requestAnimationFrame(frame)
  }, [])

  const toggle = useCallback(async () => {
    if (!supported) return
    if (!enabled) {
      const audio = ensureAudio()
      try {
        const context = ensureGraph(audio)
        if (!context) audio.volume = 0
        if (context?.state === 'suspended') await context.resume()
        await audio.play()
        enabledRef.current = true
        setEnabled(true)
        fadeTo(1)
      } catch {
        enabledRef.current = false
        setEnabled(false)
      }
      return
    }
    enabledRef.current = false
    setEnabled(false)
    const audio = audioRef.current
    if (audio) fadeTo(0, () => audio.pause())
  }, [enabled, ensureAudio, ensureGraph, fadeTo, supported])

  useEffect(() => {
    let animationFrame = 0
    const update = () => {
      const context = contextRef.current; const filter = filterRef.current; const sceneGain = sceneGainRef.current
      if (context && filter && sceneGain && enabledRef.current) {
        const profile = deriveAmbientAudioProfile(source.current)
        filter.frequency.setTargetAtTime(profile.toneCutoffHz, context.currentTime, .18)
        filter.Q.setTargetAtTime(Math.min(4, profile.noiseQ), context.currentTime, .2)
        sceneGain.gain.setTargetAtTime(TRACK_VOLUME * clamp01(profile.masterGain * 23), context.currentTime, .12)
      }
      animationFrame = window.requestAnimationFrame(update)
    }
    animationFrame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [source])

  useEffect(() => {
    const onVisibility = () => {
      const audio = audioRef.current
      if (!audio) return
      if (document.hidden) { audio.pause(); void contextRef.current?.suspend() }
      else if (enabledRef.current) {
        void contextRef.current?.resume()
        if (gateGainRef.current) gateGainRef.current.gain.value = 0
        else audio.volume = 0
        void audio.play().then(() => fadeTo(1)).catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fadeTo])

  useEffect(() => () => {
    if (fadeRef.current !== null) window.cancelAnimationFrame(fadeRef.current)
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audioRef.current = null
    void contextRef.current?.close()
    contextRef.current = null; filterRef.current = null; sceneGainRef.current = null; gateGainRef.current = null
  }, [])

  return { enabled, supported, toggle }
}
