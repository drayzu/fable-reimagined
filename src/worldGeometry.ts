export type Seed = number | string

export interface WorldTransform {
  /** Height of the authored, logical drawing surface. */
  worldHeight: number
  /** Height occupied by the experience in the document. */
  documentHeight: number
  viewportHeight: number
  scrollY: number
}

export interface WorldRange {
  start: number
  end: number
}

export interface OrganicSignalOptions {
  seed: Seed
  baseX: number
  amplitude: number
  /** Distance in world units covered by the fundamental noise wave. */
  wavelength: number
  phase?: number
  drift?: number
  octaves?: number
  lacunarity?: number
  gain?: number
}

export interface OrganicSignalSample {
  x: number
  y: number
  /** Change in x per world-y unit, useful when orienting marks to the line. */
  tangentX: number
}

const UINT32_RANGE = 4_294_967_296

export function clamp(value: number, minimum = 0, maximum = 1): number {
  const low = Math.min(minimum, maximum)
  const high = Math.max(minimum, maximum)
  return Math.min(high, Math.max(low, value))
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const amount = clamp((value - edge0) / (edge1 - edge0))
  return amount * amount * (3 - 2 * amount)
}

export function normalizeSeed(seed: Seed): number {
  if (typeof seed === 'number') return seed >>> 0

  let hash = 2_166_136_261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

function mixUint32(value: number): number {
  let mixed = value >>> 0
  mixed ^= mixed >>> 16
  mixed = Math.imul(mixed, 0x7feb352d)
  mixed ^= mixed >>> 15
  mixed = Math.imul(mixed, 0x846ca68b)
  mixed ^= mixed >>> 16
  return mixed >>> 0
}

/** A stateful Mulberry32 generator for deterministic geometry construction. */
export function createSeededRandom(seed: Seed): () => number {
  let state = normalizeSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
  }
}

/** A stateless random value, stable for a seed/index pair. */
export function randomAt(seed: Seed, index: number): number {
  const integerIndex = Math.trunc(index)
  const mixedIndex = Math.imul(integerIndex ^ (integerIndex >>> 16), 0x9e3779b1)
  return mixUint32(normalizeSeed(seed) ^ mixedIndex) / UINT32_RANGE
}

/** Smooth one-dimensional value noise in the range [-1, 1]. */
export function noise1D(position: number, seed: Seed): number {
  const left = Math.floor(position)
  const local = position - left
  const eased = local * local * (3 - 2 * local)
  const from = randomAt(seed, left) * 2 - 1
  const to = randomAt(seed, left + 1) * 2 - 1
  return lerp(from, to, eased)
}

/** Fractal noise normalized to approximately [-1, 1]. */
export function fractalNoise1D(
  position: number,
  seed: Seed,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  const octaveCount = Math.max(1, Math.floor(octaves))
  let frequency = 1
  let amplitude = 1
  let total = 0
  let weight = 0

  for (let octave = 0; octave < octaveCount; octave += 1) {
    total += noise1D(position * frequency, normalizeSeed(seed) + octave * 1_013) * amplitude
    weight += amplitude
    frequency *= lacunarity
    amplitude *= gain
  }

  return weight === 0 ? 0 : total / weight
}

function assertPositiveSpace(transform: WorldTransform): void {
  if (transform.worldHeight <= 0 || transform.documentHeight <= 0 || transform.viewportHeight <= 0) {
    throw new RangeError('World, document, and viewport heights must be positive.')
  }
}

export function worldToDocumentY(worldY: number, transform: WorldTransform): number {
  assertPositiveSpace(transform)
  return (worldY / transform.worldHeight) * transform.documentHeight
}

export function documentToWorldY(documentY: number, transform: WorldTransform): number {
  assertPositiveSpace(transform)
  return (documentY / transform.documentHeight) * transform.worldHeight
}

export function worldToViewportY(worldY: number, transform: WorldTransform): number {
  return worldToDocumentY(worldY, transform) - transform.scrollY
}

export function viewportToWorldY(viewportY: number, transform: WorldTransform): number {
  return documentToWorldY(transform.scrollY + viewportY, transform)
}

export function getVisibleWorldRange(transform: WorldTransform, overscanPx = 0): WorldRange {
  const overscan = Math.max(0, overscanPx)
  return {
    start: viewportToWorldY(-overscan, transform),
    end: viewportToWorldY(transform.viewportHeight + overscan, transform),
  }
}

export function rangesOverlap(first: WorldRange, second: WorldRange): boolean {
  const firstStart = Math.min(first.start, first.end)
  const firstEnd = Math.max(first.start, first.end)
  const secondStart = Math.min(second.start, second.end)
  const secondEnd = Math.max(second.start, second.end)
  return firstEnd >= secondStart && secondEnd >= firstStart
}

export function isWorldRangeVisible(
  range: WorldRange,
  transform: WorldTransform,
  overscanPx = 0,
): boolean {
  return rangesOverlap(range, getVisibleWorldRange(transform, overscanPx))
}

/** Fraction of a world range currently intersecting the visible camera. */
export function worldRangeVisibility(range: WorldRange, transform: WorldTransform): number {
  const visible = getVisibleWorldRange(transform)
  const start = Math.max(Math.min(range.start, range.end), visible.start)
  const end = Math.min(Math.max(range.start, range.end), visible.end)
  const length = Math.abs(range.end - range.start)
  if (length === 0) return start <= visible.end && start >= visible.start ? 1 : 0
  return clamp((end - start) / length)
}

/** World coordinate crossed by the reveal line near the viewport's lower edge. */
export function revealCandidateY(transform: WorldTransform, revealLine = 0.86): number {
  return viewportToWorldY(transform.viewportHeight * clamp(revealLine), transform)
}

/** Persistent reveal state: it can advance, but never retreats while scrolling upward. */
export function advanceMaxRevealY(previous: number, candidate: number, worldHeight = Infinity): number {
  return clamp(Math.max(previous, candidate), 0, worldHeight)
}

export function markReveal(markY: number, maxRevealY: number, feather = 64): number {
  if (feather <= 0) return maxRevealY >= markY ? 1 : 0
  return smoothstep(markY - feather, markY, maxRevealY)
}

/** Samples a continuous, deterministic line that drifts through authored world space. */
export function sampleOrganicSignal(
  worldY: number,
  options: OrganicSignalOptions,
): OrganicSignalSample {
  const wavelength = Math.max(0.000_001, Math.abs(options.wavelength))
  const phase = options.phase ?? 0
  const drift = options.drift ?? 0
  const normalizedY = worldY / wavelength + phase
  const noiseOptions = {
    octaves: options.octaves ?? 4,
    lacunarity: options.lacunarity ?? 2,
    gain: options.gain ?? 0.5,
  }

  const xAt = (y: number) => {
    const noisePosition = y / wavelength + phase
    return (
      options.baseX +
      drift * y +
      options.amplitude *
        fractalNoise1D(
          noisePosition,
          options.seed,
          noiseOptions.octaves,
          noiseOptions.lacunarity,
          noiseOptions.gain,
        )
    )
  }

  // Central differencing keeps tangent behavior stable across noise-cell boundaries.
  const epsilon = Math.max(wavelength * 0.000_5, 0.001)
  const x =
    options.baseX +
    drift * worldY +
    options.amplitude *
      fractalNoise1D(
        normalizedY,
        options.seed,
        noiseOptions.octaves,
        noiseOptions.lacunarity,
        noiseOptions.gain,
      )

  return {
    x,
    y: worldY,
    tangentX: (xAt(worldY + epsilon) - xAt(worldY - epsilon)) / (2 * epsilon),
  }
}
