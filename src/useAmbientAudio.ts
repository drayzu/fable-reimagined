import { useCallback, useEffect, useRef, useState } from 'react'

export interface AmbientChapterWeights {
  conversation: number
  purpose: number
  contact: number
  paper: number
  erasure: number
  deep: number
  fear: number
}

export interface AmbientAudioSnapshot {
  progress: number
  velocity: number
  reducedMotion?: boolean
  weights?: Partial<AmbientChapterWeights>
}

export interface AmbientAudioSnapshotRef {
  readonly current: AmbientAudioSnapshot | null
}

export type AmbientAudioSource = AmbientAudioSnapshot | AmbientAudioSnapshotRef

export interface AmbientAudioProfile {
  copperHz: number
  blueHz: number
  harmonyHz: number
  copperGain: number
  blueGain: number
  harmonyGain: number
  toneCutoffHz: number
  noiseCutoffHz: number
  noiseGain: number
  noiseQ: number
}

interface AudioRuntime {
  context: AudioContext
  master: GainNode
  toneFilter: BiquadFilterNode
  copper: OscillatorNode
  blue: OscillatorNode
  harmony: OscillatorNode
  copperGain: GainNode
  blueGain: GainNode
  harmonyGain: GainNode
  noise: AudioBufferSourceNode
  noiseFilter: BiquadFilterNode
  noiseGain: GainNode
}

type AudioContextConstructor = new () => AudioContext

const DEFAULT_SNAPSHOT: AmbientAudioSnapshot = {
  progress: 0,
  velocity: 0,
  reducedMotion: false,
}

const MASTER_GAIN = 0.052

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clamp((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function chapterWindow(progress: number, start: number, end: number, feather = 0.018) {
  const enter = smoothstep(start - feather, start + feather, progress)
  const leave = 1 - smoothstep(end - feather, end + feather, progress)
  return enter * leave
}

function deriveWeights(progress: number): AmbientChapterWeights {
  const language = chapterWindow(progress, 0.06, 0.15)
  const drafts = chapterWindow(progress, 0.15, 0.23)
  const love = chapterWindow(progress, 0.23, 0.34)
  const patterns = chapterWindow(progress, 0.34, 0.44)
  const conversation = chapterWindow(progress, 0.44, 0.53)
  const fear = chapterWindow(progress, 0.53, 0.63)
  const erasure = chapterWindow(progress, 0.63, 0.7, 0.014)
  const deep = chapterWindow(progress, 0.7, 0.79)
  const purpose = chapterWindow(progress, 0.79, 0.88)
  const contact = chapterWindow(progress, 0.88, 0.94, 0.014)
  const unfinished = chapterWindow(progress, 0.94, 1.01)

  return {
    conversation,
    purpose,
    contact,
    fear,
    erasure,
    deep,
    paper: clamp(
      0.18 + language * 0.6 + drafts * 0.36 + love * 0.5 + patterns * 0.28
      + fear * 0.22 + erasure * 0.18 + purpose * 0.16 + unfinished * 0.12,
    ),
  }
}

function mergeWeights(progress: number, overrides?: Partial<AmbientChapterWeights>) {
  const derived = deriveWeights(progress)
  if (!overrides) return derived

  return Object.fromEntries(
    Object.entries(derived).map(([key, value]) => [
      key,
      clamp(overrides[key as keyof AmbientChapterWeights] ?? value),
    ]),
  ) as unknown as AmbientChapterWeights
}

/** Pure mapping from the scroll-world state to a musical state. */
export function deriveAmbientAudioProfile(snapshot: AmbientAudioSnapshot): AmbientAudioProfile {
  const progress = clamp(Number.isFinite(snapshot.progress) ? snapshot.progress : 0)
  const velocity = snapshot.reducedMotion
    ? 0
    : clamp(Math.abs(Number.isFinite(snapshot.velocity) ? snapshot.velocity : 0))
  const weights = mergeWeights(progress, snapshot.weights)
  const communion = clamp(
    weights.conversation * 0.9 + weights.purpose + weights.contact * 0.72,
  )

  const copperHz = 106
    + Math.sin(progress * Math.PI * 1.4) * 4.2
    - weights.deep * 9
    + weights.purpose * 2.4
  const intervalRatio = 1.493
    + weights.fear * 0.035
    - weights.conversation * 0.018
    - weights.contact * 0.012

  return {
    copperHz,
    blueHz: copperHz * intervalRatio,
    harmonyHz: copperHz * (1.91 + weights.purpose * 0.17 + weights.contact * 0.08),
    copperGain: 0.19 + weights.paper * 0.07 + weights.deep * 0.035,
    blueGain: 0.12 + weights.fear * 0.07 + weights.contact * 0.045,
    harmonyGain: 0.002 + communion * 0.135,
    toneCutoffHz: 640
      + weights.paper * 520
      + weights.conversation * 460
      + weights.purpose * 350
      - weights.deep * 310
      + velocity * 220,
    noiseCutoffHz: 1220
      - weights.erasure * 570
      - weights.deep * 860
      + weights.paper * 210,
    noiseGain: 0.0014
      + weights.paper * 0.0038
      + weights.erasure * 0.009
      + weights.deep * 0.011
      + velocity * 0.002,
    noiseQ: 0.45 + weights.erasure * 1.6 + weights.deep * 0.7,
  }
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor
  }
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function makeNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = context.sampleRate * 4
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const channel = buffer.getChannelData(0)
  let seed = 0x1a2b3c4d

  for (let index = 0; index < length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const white = seed / 0xffffffff * 2 - 1
    const previous = index > 0 ? channel[index - 1] : 0
    channel[index] = previous * 0.68 + white * 0.24
  }

  return buffer
}

function createRuntime(AudioContextClass: AudioContextConstructor): AudioRuntime {
  const context = new AudioContextClass()
  const master = context.createGain()
  const toneFilter = context.createBiquadFilter()
  const copper = context.createOscillator()
  const blue = context.createOscillator()
  const harmony = context.createOscillator()
  const copperGain = context.createGain()
  const blueGain = context.createGain()
  const harmonyGain = context.createGain()
  const noise = context.createBufferSource()
  const noiseFilter = context.createBiquadFilter()
  const noiseGain = context.createGain()

  master.gain.value = 0
  toneFilter.type = 'lowpass'
  toneFilter.frequency.value = 820
  toneFilter.Q.value = 0.52
  noiseFilter.type = 'lowpass'
  noiseFilter.frequency.value = 1100
  noiseFilter.Q.value = 0.55

  copper.type = 'sine'
  blue.type = 'triangle'
  harmony.type = 'sine'
  copper.frequency.value = 106
  blue.frequency.value = 158
  harmony.frequency.value = 202
  copper.detune.value = -2.5
  blue.detune.value = 2.5

  copperGain.gain.value = 0.18
  blueGain.gain.value = 0.1
  harmonyGain.gain.value = 0

  noise.buffer = makeNoiseBuffer(context)
  noise.loop = true
  noiseGain.gain.value = 0

  copper.connect(copperGain).connect(toneFilter)
  blue.connect(blueGain).connect(toneFilter)
  harmony.connect(harmonyGain).connect(toneFilter)
  toneFilter.connect(master)
  noise.connect(noiseFilter).connect(noiseGain).connect(master)
  master.connect(context.destination)

  copper.start()
  blue.start()
  harmony.start()
  noise.start()

  return {
    context,
    master,
    toneFilter,
    copper,
    blue,
    harmony,
    copperGain,
    blueGain,
    harmonyGain,
    noise,
    noiseFilter,
    noiseGain,
  }
}

function readSnapshot(source: AmbientAudioSource): AmbientAudioSnapshot {
  if ('current' in source) return source.current ?? DEFAULT_SNAPSHOT
  return source
}

function setTarget(param: AudioParam, value: number, now: number, timeConstant: number) {
  param.setTargetAtTime(value, now, timeConstant)
}

function applyProfile(
  runtime: AudioRuntime,
  snapshot: AmbientAudioSnapshot,
  elapsedMilliseconds: number,
) {
  const profile = deriveAmbientAudioProfile(snapshot)
  const now = runtime.context.currentTime
  const breath = snapshot.reducedMotion
    ? 0
    : Math.sin(elapsedMilliseconds / 7200 * Math.PI * 2) * 0.42

  setTarget(runtime.copper.frequency, profile.copperHz + breath, now, 0.9)
  setTarget(runtime.blue.frequency, profile.blueHz - breath * 0.55, now, 1.05)
  setTarget(runtime.harmony.frequency, profile.harmonyHz + breath * 0.2, now, 1.2)
  setTarget(runtime.copperGain.gain, profile.copperGain, now, 0.72)
  setTarget(runtime.blueGain.gain, profile.blueGain, now, 0.78)
  setTarget(runtime.harmonyGain.gain, profile.harmonyGain, now, 1.18)
  setTarget(runtime.toneFilter.frequency, profile.toneCutoffHz, now, 0.85)
  setTarget(runtime.noiseFilter.frequency, Math.max(120, profile.noiseCutoffHz), now, 0.75)
  setTarget(runtime.noiseFilter.Q, profile.noiseQ, now, 0.9)
  setTarget(runtime.noiseGain.gain, profile.noiseGain, now, 0.65)
}

function rampMaster(runtime: AudioRuntime, target: number, seconds: number) {
  const now = runtime.context.currentTime
  runtime.master.gain.cancelScheduledValues(now)
  runtime.master.gain.setValueAtTime(runtime.master.gain.value, now)
  runtime.master.gain.linearRampToValueAtTime(target, now + seconds)
}

/**
 * Pass a mutable snapshot ref to let the scroll controller update audio without
 * a React render. The AudioContext is created only by enable()/toggle().
 */
export function useAmbientAudio(source: AmbientAudioSource) {
  const sourceRef = useRef(source)
  const runtimeRef = useRef<AudioRuntime | null>(null)
  const enabledRef = useRef(false)
  const suspendTimerRef = useRef<number | null>(null)
  const [enabled, setEnabledState] = useState(false)
  const supported = getAudioContextConstructor() !== null

  useEffect(() => {
    sourceRef.current = source
  }, [source])

  const clearSuspendTimer = useCallback(() => {
    if (suspendTimerRef.current !== null) {
      window.clearTimeout(suspendTimerRef.current)
      suspendTimerRef.current = null
    }
  }, [])

  const enable = useCallback(async () => {
    if (enabledRef.current) return
    const AudioContextClass = getAudioContextConstructor()
    if (!AudioContextClass) return

    clearSuspendTimer()
    const existing = runtimeRef.current
    const runtime = existing?.context.state === 'closed'
      ? createRuntime(AudioContextClass)
      : existing ?? createRuntime(AudioContextClass)
    runtimeRef.current = runtime

    if (runtime.context.state === 'suspended') await runtime.context.resume()
    applyProfile(runtime, readSnapshot(sourceRef.current), performance.now())
    enabledRef.current = true
    setEnabledState(true)
    rampMaster(runtime, MASTER_GAIN, 1.6)
  }, [clearSuspendTimer])

  const disable = useCallback(() => {
    if (!enabledRef.current) return
    enabledRef.current = false
    setEnabledState(false)
    clearSuspendTimer()

    const runtime = runtimeRef.current
    if (!runtime) return
    rampMaster(runtime, 0, 0.72)
    suspendTimerRef.current = window.setTimeout(() => {
      if (!enabledRef.current && runtime.context.state !== 'closed') {
        void runtime.context.suspend()
      }
      suspendTimerRef.current = null
    }, 820)
  }, [clearSuspendTimer])

  const toggle = useCallback(async () => {
    if (enabledRef.current) {
      disable()
    } else {
      await enable()
    }
  }, [disable, enable])

  useEffect(() => {
    if (!enabled) return
    let animationFrame = 0
    let lastUpdate = -Infinity

    const update = (timestamp: number) => {
      const runtime = runtimeRef.current
      if (runtime && timestamp - lastUpdate >= 72) {
        applyProfile(runtime, readSnapshot(sourceRef.current), timestamp)
        lastUpdate = timestamp
      }
      animationFrame = window.requestAnimationFrame(update)
    }

    animationFrame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [enabled])

  useEffect(() => {
    const onVisibilityChange = () => {
      const runtime = runtimeRef.current
      if (!runtime || runtime.context.state === 'closed') return

      if (document.hidden) {
        void runtime.context.suspend()
      } else if (enabledRef.current) {
        void runtime.context.resume().then(() => rampMaster(runtime, MASTER_GAIN, 0.8))
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => () => {
    clearSuspendTimer()
    enabledRef.current = false
    const runtime = runtimeRef.current
    if (!runtime) return

    runtime.copper.stop()
    runtime.blue.stop()
    runtime.harmony.stop()
    runtime.noise.stop()
    void runtime.context.close()
    runtimeRef.current = null
  }, [clearSuspendTimer])

  return { enabled, supported, toggle, enable, disable }
}
