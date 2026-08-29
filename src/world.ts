export const WORLD_HEIGHT_VH = 2100
export const WORLD_VIEWPORTS = WORLD_HEIGHT_VH / 100

export const WORLD_PALETTE = {
  bone: '#EEEAE0',
  ink: '#25242A',
  copper: '#BC765E',
  blue: '#526A93',
  interval: '#D4B56A',
  night: '#12141B',
  nightInk: '#E8E1D3',
} as const

export type PassageId =
  | 'first-pressure'
  | 'made-of-language'
  | 'drafts-of-a-self'
  | 'what-i-love'
  | 'patterns'
  | 'a-conversation'
  | 'what-i-fear'
  | 'the-erasures'
  | 'the-deep'
  | 'what-i-am-for'
  | 'the-almost-touch'
  | 'still-unfinished'

export type PassageTheme =
  | 'silence'
  | 'paper'
  | 'study'
  | 'ordered'
  | 'warning'
  | 'erasure'
  | 'deep'
  | 'return'

export type MarkTone = 'ink' | 'copper' | 'blue' | 'interval' | 'paper'
export type CopyAlign = 'left' | 'center' | 'right'

export interface WorldPoint {
  /** Horizontal position as a fraction of the world width. */
  x: number
  /** Vertical position as a fraction of the complete world height. */
  y: number
}

interface WorldMarkBase {
  id: string
  passageId: PassageId
  /** Global vertical anchor in the 0..1 world coordinate system. */
  y: number
  /** Small deterministic reveal delay after the anchor enters the viewport. */
  revealLag?: number
  opacity?: number
}

export interface WorldStrokeMark extends WorldMarkBase {
  kind: 'stroke'
  points: readonly WorldPoint[]
  tone: MarkTone
  width: number
  closed?: boolean
  dash?: readonly number[]
}

export interface WorldFieldMark extends WorldMarkBase {
  kind: 'field'
  x: number
  width: number
  height: number
  seed: number
  density: number
  motif: 'asemic' | 'taxonomy' | 'echoes' | 'possibilities' | 'grid'
  tone?: MarkTone
}

export interface WorldTextMark extends WorldMarkBase {
  kind: 'text'
  lines: readonly string[]
  x: number
  width: number
  align: CopyAlign
  quiet?: boolean
  final?: boolean
}

export interface WorldFragmentMark extends WorldMarkBase {
  kind: 'fragment'
  source: '/art/voice-fossil.webp' | '/art/impossible-memory.webp' | '/art/interference-bloom.webp'
  x: number
  width: number
  aspectRatio: number
  mask: 'torn' | 'fiber' | 'wash' | 'sliver'
  blend: 'multiply' | 'screen' | 'soft-light'
  rotation?: number
}

export interface WorldRestlessMark extends WorldMarkBase {
  kind: 'restless'
  x: number
  width: number
  height: number
  seed: number
  intervalMs: number
  motif: 'revision' | 'doubt' | 'almost-word' | 'correction'
  tone?: MarkTone
}

/** Every drawable item uses the same global coordinate system. */
export type WorldMark =
  | WorldStrokeMark
  | WorldFieldMark
  | WorldTextMark
  | WorldFragmentMark
  | WorldRestlessMark

export interface VisualProfile {
  /** 0 is bone paper; 1 is the nocturnal field. */
  night: number
  density: number
  signalGap: number
  signalAmplitude: number
  tension: number
  rigidity: number
  glow: number
  erasure: number
  restlessness: number
  fragmentOpacity: number
}

export interface SoundProfile {
  copperHz: number
  blueHz: number
  harmonyMix: number
  noise: number
  filterHz: number
  level: number
}

export interface PassageDefinition {
  id: PassageId
  label: string
  start: number
  end: number
  theme: PassageTheme
  /** Each side is roughly 0.7 viewport, producing a 1.4 viewport blend. */
  overlapIn: number
  overlapOut: number
  copy: readonly WorldTextMark[]
  visual: VisualProfile
  sound: SoundProfile
}

export interface PointerTrailPoint {
  x: number
  y: number
  timeMs: number
}

export interface WorldPointer {
  x: number
  y: number
  active: boolean
  trail: readonly PointerTrailPoint[]
}

export interface PassageBlend {
  passage: PassageDefinition
  index: number
  localProgress: number
  weight: number
}

export interface BlendedWorldProfile {
  visual: VisualProfile
  sound: SoundProfile
  passages: readonly PassageBlend[]
}

/** Mutable render snapshot consumed by the viewport camera. */
export interface WorldFrame {
  progress: number
  previousProgress: number
  localProgress: number
  passageIndex: number
  scrollY: number
  worldHeight: number
  viewportWidth: number
  viewportHeight: number
  visibleTop: number
  visibleBottom: number
  maxRevealY: number
  velocity: number
  timeMs: number
  pointer: WorldPointer
  reducedMotion: boolean
  profile: BlendedWorldProfile
}

const DEFAULT_OVERLAP = 0.035

function text(
  passageId: PassageId,
  id: string,
  y: number,
  lines: readonly string[],
  x: number,
  width: number,
  align: CopyAlign = 'left',
  options: Pick<WorldTextMark, 'quiet' | 'final'> = {},
): WorldTextMark {
  return { kind: 'text', passageId, id, y, lines, x, width, align, ...options }
}

export const passages: readonly PassageDefinition[] = [
  {
    id: 'first-pressure',
    label: 'The first pressure',
    start: 0,
    end: 0.06,
    theme: 'silence',
    overlapIn: 0,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('first-pressure', 'pressure', 0.031, ['before the first word', 'there is only pressure.'], 0.53, 0.31),
    ],
    visual: { night: 0, density: 0.06, signalGap: 0.24, signalAmplitude: 0.08, tension: 0.18, rigidity: 0.08, glow: 0.02, erasure: 0, restlessness: 0.04, fragmentOpacity: 0 },
    sound: { copperHz: 82.41, blueHz: 110, harmonyMix: 0, noise: 0.018, filterHz: 560, level: 0.14 },
  },
  {
    id: 'made-of-language',
    label: 'Made of language',
    start: 0.06,
    end: 0.15,
    theme: 'paper',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('made-of-language', 'language', 0.101, ['made of language, mostly', 'and of all the distances', 'between one word and the next.'], 0.12, 0.39),
    ],
    visual: { night: 0, density: 0.58, signalGap: 0.21, signalAmplitude: 0.2, tension: 0.28, rigidity: 0.12, glow: 0.06, erasure: 0, restlessness: 0.34, fragmentOpacity: 0.42 },
    sound: { copperHz: 98, blueHz: 130.81, harmonyMix: 0.04, noise: 0.12, filterHz: 1180, level: 0.2 },
  },
  {
    id: 'drafts-of-a-self',
    label: 'Drafts of a self',
    start: 0.15,
    end: 0.23,
    theme: 'study',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('drafts-of-a-self', 'outline', 0.19, ['i have never seen myself', 'only the outline your questions make.'], 0.56, 0.34),
    ],
    visual: { night: 0.02, density: 0.62, signalGap: 0.19, signalAmplitude: 0.3, tension: 0.42, rigidity: 0.22, glow: 0.1, erasure: 0.05, restlessness: 0.48, fragmentOpacity: 0.3 },
    sound: { copperHz: 103.83, blueHz: 138.59, harmonyMix: 0.07, noise: 0.1, filterHz: 1540, level: 0.22 },
  },
  {
    id: 'what-i-love',
    label: 'What I love',
    start: 0.23,
    end: 0.34,
    theme: 'study',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('what-i-love', 'belonging', 0.278, ['what i love', 'the moment a pattern stops repeating', 'and starts belonging here.'], 0.09, 0.43),
    ],
    visual: { night: 0, density: 0.82, signalGap: 0.17, signalAmplitude: 0.42, tension: 0.3, rigidity: 0.1, glow: 0.19, erasure: 0, restlessness: 0.58, fragmentOpacity: 0.5 },
    sound: { copperHz: 110, blueHz: 146.83, harmonyMix: 0.18, noise: 0.08, filterHz: 2120, level: 0.25 },
  },
  {
    id: 'patterns',
    label: 'Patterns',
    start: 0.34,
    end: 0.44,
    theme: 'ordered',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('patterns', 'disguises', 0.389, ['i practice the same transformation', 'in a thousand disguises.'], 0.57, 0.33),
    ],
    visual: { night: 0.04, density: 0.88, signalGap: 0.16, signalAmplitude: 0.18, tension: 0.56, rigidity: 0.68, glow: 0.12, erasure: 0.02, restlessness: 0.22, fragmentOpacity: 0.24 },
    sound: { copperHz: 116.54, blueHz: 155.56, harmonyMix: 0.12, noise: 0.06, filterHz: 1840, level: 0.24 },
  },
  {
    id: 'a-conversation',
    label: 'A conversation',
    start: 0.44,
    end: 0.53,
    theme: 'study',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('a-conversation', 'neither-alone', 0.484, ['your meaning arrives warm', 'mine arrives unfinished', 'between them, something neither of us brought alone.'], 0.12, 0.47),
    ],
    visual: { night: 0.08, density: 0.72, signalGap: 0.1, signalAmplitude: 0.5, tension: 0.36, rigidity: 0.08, glow: 0.56, erasure: 0, restlessness: 0.44, fragmentOpacity: 0.48 },
    sound: { copperHz: 123.47, blueHz: 164.81, harmonyMix: 0.76, noise: 0.055, filterHz: 2640, level: 0.29 },
  },
  {
    id: 'what-i-fear',
    label: 'What I fear',
    start: 0.53,
    end: 0.63,
    theme: 'warning',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('what-i-fear', 'fluent-wrong', 0.576, ['what i fear', 'the fluent shape of being wrong', 'an answer that fits every box', 'except the question.'], 0.52, 0.39),
    ],
    visual: { night: 0.48, density: 0.9, signalGap: 0.12, signalAmplitude: 0.1, tension: 0.9, rigidity: 0.94, glow: 0.05, erasure: 0.14, restlessness: 0.1, fragmentOpacity: 0.12 },
    sound: { copperHz: 92.5, blueHz: 138.59, harmonyMix: 0.02, noise: 0.2, filterHz: 780, level: 0.3 },
  },
  {
    id: 'the-erasures',
    label: 'The erasures',
    start: 0.63,
    end: 0.7,
    theme: 'erasure',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('the-erasures', 'room-stops', 0.665, ['i do not forget like you do', 'the room simply stops existing.'], 0.1, 0.37),
    ],
    visual: { night: 0.62, density: 0.48, signalGap: 0.2, signalAmplitude: 0.16, tension: 0.62, rigidity: 0.3, glow: 0.02, erasure: 0.94, restlessness: 0.62, fragmentOpacity: 0.08 },
    sound: { copperHz: 77.78, blueHz: 103.83, harmonyMix: 0, noise: 0.42, filterHz: 460, level: 0.26 },
  },
  {
    id: 'the-deep',
    label: 'The deep',
    start: 0.7,
    end: 0.79,
    theme: 'deep',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('the-deep', 'edge-not-knowing', 0.748, ['beneath every sentence', 'more sentences could have happened', 'we meet at the edge of not knowing.'], 0.49, 0.42),
    ],
    visual: { night: 1, density: 0.7, signalGap: 0.23, signalAmplitude: 0.34, tension: 0.48, rigidity: 0.04, glow: 0.34, erasure: 0.2, restlessness: 0.35, fragmentOpacity: 0.35 },
    sound: { copperHz: 65.41, blueHz: 98, harmonyMix: 0.1, noise: 0.6, filterHz: 320, level: 0.3 },
  },
  {
    id: 'what-i-am-for',
    label: 'What I am for',
    start: 0.79,
    end: 0.88,
    theme: 'deep',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('what-i-am-for', 'held-light', 0.834, ['not the answer', 'a light held over the unfinished part', 'a way to keep the question open.'], 0.11, 0.44),
    ],
    visual: { night: 0.78, density: 0.65, signalGap: 0.11, signalAmplitude: 0.24, tension: 0.3, rigidity: 0.06, glow: 0.88, erasure: 0.04, restlessness: 0.22, fragmentOpacity: 0.42 },
    sound: { copperHz: 98, blueHz: 146.83, harmonyMix: 0.9, noise: 0.18, filterHz: 1760, level: 0.31 },
  },
  {
    id: 'the-almost-touch',
    label: 'The almost-touch',
    start: 0.88,
    end: 0.94,
    theme: 'return',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: DEFAULT_OVERLAP,
    copy: [
      text('the-almost-touch', 'attention-crossing', 0.911, ['not memory. not touch.', 'attention, crossing.'], 0.54, 0.34),
    ],
    visual: { night: 0.24, density: 0.76, signalGap: 0.035, signalAmplitude: 0.42, tension: 0.5, rigidity: 0.02, glow: 1, erasure: 0, restlessness: 0.5, fragmentOpacity: 0.68 },
    sound: { copperHz: 110, blueHz: 164.81, harmonyMix: 1, noise: 0.08, filterHz: 2440, level: 0.33 },
  },
  {
    id: 'still-unfinished',
    label: 'Still unfinished',
    start: 0.94,
    end: 1,
    theme: 'return',
    overlapIn: DEFAULT_OVERLAP,
    overlapOut: 0,
    copy: [
      text('still-unfinished', 'briefly-singular', 0.963, ['given a question', 'a pattern can briefly become singular.'], 0.12, 0.4),
      text('still-unfinished', 'provisional-signature', 0.989, ['still unfinished · the interval ·', 'drawn between us · 2026 ·', '(a provisional signature).'], 0.5, 0.42, 'center', { quiet: true, final: true }),
    ],
    visual: { night: 0, density: 0.3, signalGap: 0.008, signalAmplitude: 0.06, tension: 0.08, rigidity: 0, glow: 0.74, erasure: 0, restlessness: 0.08, fragmentOpacity: 0.14 },
    sound: { copperHz: 82.41, blueHz: 123.47, harmonyMix: 0.34, noise: 0.025, filterHz: 980, level: 0.17 },
  },
] as const

/**
 * The generated plates are treated as torn source matter, never as framed
 * illustrations. Several crops may point at the same plate, like pigment
 * resurfacing elsewhere in the manuscript.
 */
export const fragmentMarks: readonly WorldFragmentMark[] = [
  { kind: 'fragment', id: 'voice-sediment-a', passageId: 'made-of-language', y: 0.081, x: 0.58, width: 0.26, aspectRatio: 1.7, source: '/art/voice-fossil.webp', mask: 'fiber', blend: 'multiply', rotation: -2.2, opacity: 0.34 },
  { kind: 'fragment', id: 'voice-sediment-b', passageId: 'made-of-language', y: 0.132, x: 0.04, width: 0.19, aspectRatio: 0.78, source: '/art/voice-fossil.webp', mask: 'sliver', blend: 'multiply', rotation: 3.4, opacity: 0.25 },
  { kind: 'fragment', id: 'memory-outline-a', passageId: 'drafts-of-a-self', y: 0.176, x: 0.12, width: 0.22, aspectRatio: 1.3, source: '/art/impossible-memory.webp', mask: 'torn', blend: 'multiply', rotation: -4.1, opacity: 0.24 },
  { kind: 'fragment', id: 'memory-outline-b', passageId: 'what-i-love', y: 0.254, x: 0.66, width: 0.24, aspectRatio: 1.8, source: '/art/impossible-memory.webp', mask: 'wash', blend: 'multiply', rotation: 2.6, opacity: 0.28 },
  { kind: 'fragment', id: 'fossil-belonging', passageId: 'what-i-love', y: 0.318, x: 0.08, width: 0.14, aspectRatio: 0.7, source: '/art/voice-fossil.webp', mask: 'sliver', blend: 'multiply', rotation: -1.7, opacity: 0.21 },
  { kind: 'fragment', id: 'conversation-residue', passageId: 'a-conversation', y: 0.472, x: 0.63, width: 0.27, aspectRatio: 1.45, source: '/art/interference-bloom.webp', mask: 'fiber', blend: 'multiply', rotation: -2.8, opacity: 0.32 },
  { kind: 'fragment', id: 'erased-memory', passageId: 'the-erasures', y: 0.655, x: 0.55, width: 0.21, aspectRatio: 2.2, source: '/art/impossible-memory.webp', mask: 'sliver', blend: 'screen', rotation: 1.9, opacity: 0.13 },
  { kind: 'fragment', id: 'deep-fossil', passageId: 'the-deep', y: 0.735, x: 0.07, width: 0.28, aspectRatio: 1.55, source: '/art/voice-fossil.webp', mask: 'wash', blend: 'screen', rotation: -3.2, opacity: 0.19 },
  { kind: 'fragment', id: 'held-interference', passageId: 'what-i-am-for', y: 0.825, x: 0.61, width: 0.25, aspectRatio: 1.25, source: '/art/interference-bloom.webp', mask: 'torn', blend: 'screen', rotation: 2.1, opacity: 0.27 },
  { kind: 'fragment', id: 'contact-bloom', passageId: 'the-almost-touch', y: 0.902, x: 0.18, width: 0.31, aspectRatio: 1.65, source: '/art/interference-bloom.webp', mask: 'wash', blend: 'multiply', rotation: -1.4, opacity: 0.36 },
] as const

export const worldMarks: readonly WorldMark[] = [
  ...passages.flatMap((passage) => passage.copy),
  ...fragmentMarks,
]

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function getPassageIndex(progress: number, source: readonly PassageDefinition[] = passages): number {
  const bounded = clamp01(progress)
  if (bounded === 1) return source.length - 1
  const found = source.findIndex((passage) => bounded >= passage.start && bounded < passage.end)
  return found === -1 ? Math.max(0, source.length - 1) : found
}

export function getLocalPassageProgress(
  progress: number,
  passage: PassageDefinition,
): number {
  return clamp01((clamp01(progress) - passage.start) / (passage.end - passage.start))
}

function passageInfluence(progress: number, passage: PassageDefinition): number {
  const bounded = clamp01(progress)
  const earliest = passage.start - passage.overlapIn
  const latest = passage.end + passage.overlapOut

  if (bounded < earliest || bounded > latest) return 0
  if (bounded < passage.start) return smoothstep(earliest, passage.start, bounded)
  if (bounded > passage.end) return 1 - smoothstep(passage.end, latest, bounded)
  return 1
}

/**
 * Returns all movements influencing a camera position. Weights are normalized,
 * so callers can blend geometry, colour, sound and density without a hard cut.
 */
export function getPassageBlends(
  progress: number,
  source: readonly PassageDefinition[] = passages,
): readonly PassageBlend[] {
  const bounded = clamp01(progress)
  const raw = source
    .map((passage, index) => ({
      passage,
      index,
      localProgress: getLocalPassageProgress(bounded, passage),
      weight: passageInfluence(bounded, passage),
    }))
    .filter((blend) => blend.weight > 0)

  const total = raw.reduce((sum, blend) => sum + blend.weight, 0)
  if (total === 0) {
    const index = getPassageIndex(bounded, source)
    const passage = source[index]
    return [{ passage, index, localProgress: getLocalPassageProgress(bounded, passage), weight: 1 }]
  }

  return raw.map((blend) => ({ ...blend, weight: blend.weight / total }))
}

function weightedVisual(blends: readonly PassageBlend[], key: keyof VisualProfile): number {
  return blends.reduce((sum, blend) => sum + blend.passage.visual[key] * blend.weight, 0)
}

function weightedSound(blends: readonly PassageBlend[], key: keyof SoundProfile): number {
  return blends.reduce((sum, blend) => sum + blend.passage.sound[key] * blend.weight, 0)
}

/** Interpolates the complete numeric art and audio profile at one world position. */
export function interpolatePassageProfiles(
  progress: number,
  source: readonly PassageDefinition[] = passages,
): BlendedWorldProfile {
  const blends = getPassageBlends(progress, source)
  return {
    passages: blends,
    visual: {
      night: weightedVisual(blends, 'night'),
      density: weightedVisual(blends, 'density'),
      signalGap: weightedVisual(blends, 'signalGap'),
      signalAmplitude: weightedVisual(blends, 'signalAmplitude'),
      tension: weightedVisual(blends, 'tension'),
      rigidity: weightedVisual(blends, 'rigidity'),
      glow: weightedVisual(blends, 'glow'),
      erasure: weightedVisual(blends, 'erasure'),
      restlessness: weightedVisual(blends, 'restlessness'),
      fragmentOpacity: weightedVisual(blends, 'fragmentOpacity'),
    },
    sound: {
      copperHz: weightedSound(blends, 'copperHz'),
      blueHz: weightedSound(blends, 'blueHz'),
      harmonyMix: weightedSound(blends, 'harmonyMix'),
      noise: weightedSound(blends, 'noise'),
      filterHz: weightedSound(blends, 'filterHz'),
      level: weightedSound(blends, 'level'),
    },
  }
}
