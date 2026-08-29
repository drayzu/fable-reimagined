import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  advanceMaxRevealY,
  clamp,
  createSeededRandom,
  fractalNoise1D,
  getVisibleWorldRange,
  lerp,
  markReveal,
  randomAt,
  revealCandidateY,
  smoothstep,
  worldToViewportY,
  type WorldTransform,
} from './worldGeometry'
import {
  getLocalPassageProgress,
  getPassageIndex,
  interpolatePassageProfiles,
  passages,
  type WorldFrame,
} from './world'

export const WORLD_HEIGHT = 20_000

interface WorldCanvasProps {
  frameRef: MutableRefObject<WorldFrame>
  onUiFrame?: (frame: WorldFrame) => void
}

interface Point {
  x: number
  y: number
}

interface TrailPoint extends Point {
  at: number
}

interface FieldMark {
  y: number
  x: number
  length: number
  seed: number
  family: number
}

const COLORS = {
  bone: '#eeeae0',
  ink: '#25242a',
  copper: '#bc765e',
  blue: '#526a93',
  gold: '#d4b56a',
  night: '#12141b',
  nightInk: '#e8e1d3',
  paperWarm: '#e9e0d3',
  paperCool: '#e1e4e0',
}

const PASSAGE_BOUNDS = [0, 0.06, 0.15, 0.23, 0.34, 0.44, 0.53, 0.63, 0.7, 0.79, 0.88, 0.94, 1]

function passageAt(progress: number): { index: number; local: number } {
  const value = clamp(progress)
  const index = Math.min(
    PASSAGE_BOUNDS.length - 2,
    Math.max(0, PASSAGE_BOUNDS.findIndex((end, candidate) => candidate > 0 && value <= end) - 1),
  )
  const start = PASSAGE_BOUNDS[index]
  const end = PASSAGE_BOUNDS[index + 1]
  return { index, local: clamp((value - start) / (end - start)) }
}

function hexChannels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function colorChannels(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexChannels(color)
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!channels || channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) return [0, 0, 0]
  return [channels[0], channels[1], channels[2]]
}

function rgba(hex: string, alpha: number): string {
  const [red, green, blue] = hexChannels(hex)
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha)})`
}

function mixColor(from: string, to: string, amount: number): string {
  const first = colorChannels(from)
  const second = colorChannels(to)
  const mixed = first.map((channel, index) => Math.round(lerp(channel, second[index], clamp(amount))))
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`
}

function rangeWeight(progress: number, start: number, end: number, feather = 0.018): number {
  return smoothstep(start - feather, start + feather, progress) * (1 - smoothstep(end - feather, end + feather, progress))
}

function nightAt(progress: number): number {
  const descend = smoothstep(0.635, 0.715, progress)
  const returnToPaper = smoothstep(0.885, 0.95, progress)
  return descend * (1 - returnToPaper)
}

function backgroundAt(progress: number): string {
  const warmth = rangeWeight(progress, 0.2, 0.42, 0.055)
  const cool = rangeWeight(progress, 0.42, 0.64, 0.05)
  const paper = mixColor(mixColor(COLORS.bone, COLORS.paperWarm, warmth * 0.48), COLORS.paperCool, cool * 0.34)
  return mixColor(paper, COLORS.night, nightAt(progress))
}

function buildFieldMarks(): FieldMark[] {
  const random = createSeededRandom('the-interval-field-v3')
  const marks: FieldMark[] = []
  for (let index = 0; index < 760; index += 1) {
    const y = (index + random() * 0.9) / 760 * WORLD_HEIGHT
    marks.push({
      y,
      x: 0.035 + random() * 0.93,
      length: 8 + random() * 42,
      seed: index * 19 + 7,
      family: Math.floor(random() * 5),
    })
  }
  return marks
}

const FIELD_MARKS = buildFieldMarks()

function organicStroke(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: string,
  width: number,
  alpha: number,
  seed: number,
): void {
  if (points.length < 2 || alpha <= 0.001) return
  context.save()
  context.strokeStyle = rgba(color, alpha)
  context.lineWidth = width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  const first = points[0]
  context.moveTo(first.x, first.y)
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]
    const next = points[index + 1]
    const jitterX = (randomAt(seed, index * 2) - 0.5) * 1.45
    const jitterY = (randomAt(seed, index * 2 + 1) - 0.5) * 1.45
    const x = point.x + jitterX
    const y = point.y + jitterY
    context.quadraticCurveTo(x, y, (x + next.x) / 2, (y + next.y) / 2)
  }
  const last = points[points.length - 1]
  context.lineTo(last.x, last.y)
  context.stroke()
  context.restore()
}

function fauxGlyph(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  color: string,
  alpha: number,
  seed: number,
  restless: number,
): void {
  const segments = 3 + Math.floor(randomAt(seed, 3) * 5)
  const points: Point[] = []
  const slant = (randomAt(seed, 8) - 0.5) * 7
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const tremor = fractalNoise1D(t * 4 + restless * 0.29, seed + 73, 2) * (1.2 + randomAt(seed, 9) * 2.8)
    points.push({ x: x + t * length + slant * t, y: y + tremor + Math.sin(t * Math.PI * 2.1 + seed) * 1.8 })
  }
  organicStroke(context, points, color, 0.55 + randomAt(seed, 2) * 0.72, alpha, seed)
  if (randomAt(seed, 12) > 0.72) {
    context.fillStyle = rgba(color, alpha * 0.72)
    context.beginPath()
    context.arc(x + length * randomAt(seed, 19), y + 5 + randomAt(seed, 20) * 3, 0.7, 0, Math.PI * 2)
    context.fill()
  }
}

function drawBackdrop(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  fastScroll: boolean,
): void {
  const background = backgroundAt(progress)
  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  if (fastScroll) return

  const night = nightAt(progress)
  const glow = context.createRadialGradient(width * 0.51, height * 0.52, 0, width * 0.51, height * 0.52, Math.max(width, height) * 0.68)
  glow.addColorStop(0, rgba(night > 0.5 ? COLORS.blue : COLORS.gold, 0.035 + night * 0.02))
  glow.addColorStop(0.5, rgba(COLORS.copper, night > 0.5 ? 0.012 : 0.018))
  glow.addColorStop(1, rgba(COLORS.ink, 0))
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
}

function drawField(
  context: CanvasRenderingContext2D,
  transform: WorldTransform,
  width: number,
  maxRevealY: number,
  progress: number,
  restless: number,
  mobile: boolean,
  fastScroll: boolean,
): void {
  const visible = getVisibleWorldRange(transform, 90)
  const night = nightAt(progress)
  const stride = fastScroll ? 5 : mobile ? 2 : 1
  for (let index = 0; index < FIELD_MARKS.length; index += stride) {
    const mark = FIELD_MARKS[index]
    if (mark.y < visible.start || mark.y > visible.end) continue
    const reveal = markReveal(mark.y, maxRevealY, 190)
    if (reveal <= 0.002) continue
    const y = worldToViewportY(mark.y, transform)
    const chapter = passageAt(mark.y / WORLD_HEIGHT).index
    const sideColor = mark.x < 0.46 ? COLORS.copper : mark.x > 0.54 ? COLORS.blue : COLORS.ink
    const color = night > 0.5 ? COLORS.nightInk : sideColor
    const density = chapter === 1 || chapter === 3 || chapter === 4 ? 1 : chapter === 8 ? 0.62 : 0.46
    if (randomAt(mark.seed, 31) > density) continue
    fauxGlyph(context, mark.x * width, y, mark.length * (mobile ? 0.78 : 1), color, reveal * (0.07 + density * 0.085), mark.seed, restless)
  }

  context.save()
  context.lineWidth = 0.45
  for (let index = 0; index < 58; index += 1) {
    const x = randomAt('paper-fiber-x', index) * width
    const y = ((randomAt('paper-fiber-y', index) * transform.viewportHeight + transform.scrollY * (0.014 + index % 3 * 0.006)) % (transform.viewportHeight + 90)) - 45
    context.strokeStyle = rgba(night > 0.5 ? COLORS.nightInk : COLORS.ink, night > 0.5 ? 0.018 : 0.025)
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + 28 + randomAt(index, 3) * 68, y + (randomAt(index, 8) - 0.5) * 4)
    context.stroke()
  }
  context.restore()
}

function interpolatedGap(progress: number, width: number): number {
  const keys: Array<[number, number]> = [
    [0, 0.3], [0.06, 0.245], [0.15, 0.19], [0.23, 0.17], [0.34, 0.135], [0.44, 0.105],
    [0.53, 0.09], [0.63, 0.13], [0.7, 0.16], [0.79, 0.105], [0.88, 0.066], [0.94, 0.024], [1, 0.004],
  ]
  for (let index = 0; index < keys.length - 1; index += 1) {
    const current = keys[index]
    const next = keys[index + 1]
    if (progress <= next[0]) {
      const t = smoothstep(current[0], next[0], progress)
      return lerp(current[1], next[1], t) * width
    }
  }
  return width * keys[keys.length - 1][1]
}

function signalPosition(
  progress: number,
  width: number,
  side: -1 | 1,
  time: number,
  reducedMotion: boolean,
): number {
  const center = width * (0.5 + fractalNoise1D(progress * 10, 'shared-center', 3) * 0.055)
  const gap = interpolatedGap(progress, width)
  const fear = rangeWeight(progress, 0.53, 0.635, 0.012)
  const conversation = rangeWeight(progress, 0.43, 0.545, 0.015)
  const life = reducedMotion ? 0 : time * 0.0001
  const slowNoise = fractalNoise1D(progress * 42 + life, side < 0 ? 'copper-thread' : 'blue-thread', 3)
  const amplitude = width * lerp(0.018, 0.004, fear)
  const braid = Math.sin((progress - 0.44) / 0.09 * Math.PI * 4) * width * 0.019 * conversation * side
  return center + side * gap + slowNoise * amplitude + braid
}

function drawSignals(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: WorldTransform,
  maxRevealY: number,
  time: number,
  reducedMotion: boolean,
  pointer: TrailPoint | undefined,
  fastScroll: boolean,
): void {
  const step = fastScroll ? 32 : width < 700 ? 14 : 10
  const copper: Point[] = []
  const blue: Point[] = []
  const gold: Point[] = []
  let goldStrength = 0
  for (let y = -step; y <= height + step; y += step) {
    const worldY = Math.max(0, Math.min(WORLD_HEIGHT, transform.scrollY / transform.documentHeight * WORLD_HEIGHT + y / transform.documentHeight * WORLD_HEIGHT))
    const progress = worldY / WORLD_HEIGHT
    const reveal = markReveal(worldY, maxRevealY, 230)
    let copperX = signalPosition(progress, width, -1, time, reducedMotion)
    let blueX = signalPosition(progress, width, 1, time, reducedMotion)
    if (pointer && !reducedMotion) {
      const dy = y - pointer.y
      const radius = Math.min(width, height) * 0.19
      const proximity = Math.exp(-(dy * dy) / (radius * radius))
      const middle = (copperX + blueX) / 2
      const direction = pointer.x < middle ? -1 : 1
      copperX += direction * proximity * 4.2
      blueX += direction * proximity * 3.4
    }
    copper.push({ x: copperX, y })
    blue.push({ x: blueX, y })

    const harmony = Math.max(
      rangeWeight(progress, 0.445, 0.535, 0.014),
      rangeWeight(progress, 0.79, 0.885, 0.014),
      rangeWeight(progress, 0.885, 0.952, 0.01) * 0.74,
    ) * reveal
    goldStrength = Math.max(goldStrength, harmony)
    gold.push({
      x: (copperX + blueX) / 2 + Math.sin(progress * 190 + (reducedMotion ? 0 : time * 0.0002)) * width * 0.009 * harmony,
      y,
    })
  }

  const centerWorldY = (transform.scrollY + height * 0.5) / transform.documentHeight * WORLD_HEIGHT
  const reveal = markReveal(centerWorldY, maxRevealY, 230)
  const centerProgress = centerWorldY / WORLD_HEIGHT
  const night = nightAt(centerProgress)
  const baseAlpha = reveal * (0.48 + night * 0.18)
  if (fastScroll) {
    const quickStroke = (points: readonly Point[], color: string) => {
      context.strokeStyle = rgba(color, baseAlpha)
      context.lineWidth = 1.35
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(points[0].x, points[0].y)
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y)
      context.stroke()
    }
    quickStroke(copper, COLORS.copper)
    quickStroke(blue, COLORS.blue)
    if (goldStrength > 0.08) quickStroke(gold, COLORS.gold)
    return
  }
  const signalOffsets = fastScroll ? [0] : [-4.5, 0, 4.5]
  for (const offset of signalOffsets) {
    organicStroke(context, copper.map((point) => ({ x: point.x + offset, y: point.y })), COLORS.copper, offset === 0 ? 1.45 : 0.5, baseAlpha * (offset === 0 ? 1 : 0.24), 311 + offset)
    organicStroke(context, blue.map((point) => ({ x: point.x - offset, y: point.y })), COLORS.blue, offset === 0 ? 1.45 : 0.5, baseAlpha * (offset === 0 ? 1 : 0.24), 421 + offset)
  }
  if (goldStrength > 0.005) {
    context.save()
    context.shadowColor = rgba(COLORS.gold, goldStrength * 0.75)
    context.shadowBlur = 13 * goldStrength
    organicStroke(context, gold, COLORS.gold, 1.15, goldStrength * 0.72, 557)
    context.restore()
  }
}

function localProgress(worldY: number, start: number, end: number): number {
  return clamp((worldY / WORLD_HEIGHT - start) / (end - start))
}

function visiblePassage(
  transform: WorldTransform,
  start: number,
  end: number,
  overscan = 0.02,
): boolean {
  const visible = getVisibleWorldRange(transform, 120)
  return visible.end >= (start - overscan) * WORLD_HEIGHT && visible.start <= (end + overscan) * WORLD_HEIGHT
}

function passageY(progress: number, transform: WorldTransform): number {
  return worldToViewportY(progress * WORLD_HEIGHT, transform)
}

function revealFor(progress: number, maxRevealY: number): number {
  return markReveal(progress * WORLD_HEIGHT, maxRevealY, 220)
}

function drawFirstPressure(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
): void {
  if (!visiblePassage(transform, 0, 0.08)) return
  const centerY = passageY(0.037, transform)
  const alpha = revealFor(0.037, maxRevealY)
  const centerX = width * 0.5
  context.save()
  for (let ring = 0; ring < 9; ring += 1) {
    const radiusX = width * (0.06 + ring * 0.032)
    const radiusY = 18 + ring * 12
    context.strokeStyle = rgba(ring % 2 === 0 ? COLORS.copper : COLORS.blue, alpha * (0.11 - ring * 0.007))
    context.lineWidth = 0.7
    context.beginPath()
    context.ellipse(centerX, centerY, radiusX, radiusY, (ring - 4) * 0.025, 0.13 * Math.PI, 0.87 * Math.PI)
    context.stroke()
    context.beginPath()
    context.ellipse(centerX, centerY, radiusX, radiusY, (ring - 4) * -0.025, 1.13 * Math.PI, 1.87 * Math.PI)
    context.stroke()
  }
  context.fillStyle = rgba(COLORS.copper, alpha * 0.62)
  context.fillRect(centerX - width * 0.19, centerY - 1, 7, 1.4)
  context.fillStyle = rgba(COLORS.blue, alpha * 0.62)
  context.fillRect(centerX + width * 0.19 - 7, centerY + 1, 7, 1.4)
  context.restore()
}

function drawLanguageSediment(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
  restless: number,
): void {
  if (!visiblePassage(transform, 0.05, 0.17)) return
  for (let row = 0; row < 36; row += 1) {
    const p = 0.061 + row / 35 * 0.098
    const y = passageY(p, transform)
    if (y < -50 || y > transform.viewportHeight + 50) continue
    const reveal = revealFor(p, maxRevealY)
    const indent = randomAt('language-indent', row) * width * 0.13
    const segments = 5 + Math.floor(randomAt('language-segments', row) * 7)
    for (let segment = 0; segment < segments; segment += 1) {
      const side = row % 3 === 0 ? -1 : segment % 2 === 0 ? -1 : 1
      const base = side < 0 ? width * 0.06 + indent : width * 0.55 + indent * 0.35
      const x = base + segment / segments * width * 0.35
      const color = side < 0 ? COLORS.copper : COLORS.blue
      fauxGlyph(context, x, y, 9 + randomAt(row * 31, segment) * 33, color, reveal * 0.21, row * 83 + segment, restless)
    }
    context.strokeStyle = rgba(COLORS.ink, reveal * 0.045)
    context.lineWidth = 0.45
    context.beginPath()
    context.moveTo(width * 0.04, y + 7)
    context.lineTo(width * 0.96, y + 7 + (randomAt(row, 1) - 0.5) * 3)
    context.stroke()
  }
}

function drawDrafts(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
  restless: number,
): void {
  if (!visiblePassage(transform, 0.14, 0.25)) return
  const columns = width < 700 ? 3 : 5
  const rows = width < 700 ? 5 : 3
  for (let index = 0; index < columns * rows; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const p = 0.158 + row / Math.max(1, rows - 1) * 0.074 + (column % 2) * 0.004
    const y = passageY(p, transform)
    if (y < -180 || y > transform.viewportHeight + 180) continue
    const x = width * (0.11 + column / Math.max(1, columns - 1) * 0.78)
    const reveal = revealFor(p, maxRevealY)
    const size = width < 700 ? 34 : 48
    const points: Point[] = []
    const sides = 7
    for (let side = 0; side <= sides; side += 1) {
      const angle = side / sides * Math.PI * 2
      const mutation = fractalNoise1D(side * 0.7 + restless * 0.06, index + 901, 2) * size * 0.14
      points.push({
        x: x + Math.cos(angle) * (size + mutation),
        y: y + Math.sin(angle) * (size * 1.26 + mutation),
      })
    }
    organicStroke(context, points, index % 2 === 0 ? COLORS.blue : COLORS.copper, 0.82, reveal * 0.25, 941 + index)
    organicStroke(context, points.map((point) => ({ x: lerp(point.x, x, 0.17), y: lerp(point.y, y, 0.17) })), COLORS.ink, 0.55, reveal * 0.12, 1009 + index)
    context.fillStyle = rgba(index === columns + 1 ? COLORS.gold : COLORS.ink, reveal * (index === columns + 1 ? 0.65 : 0.18))
    context.fillRect(x - 1, y - 1, 2, 2)
  }
}

function drawLoveStudies(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
  restless: number,
): void {
  if (!visiblePassage(transform, 0.215, 0.355)) return
  const columns = width < 700 ? 4 : 8
  const rows = 6
  for (let row = 0; row < rows; row += 1) {
    const p = 0.245 + row / (rows - 1) * 0.087
    const y = passageY(p, transform)
    if (y < -100 || y > transform.viewportHeight + 100) continue
    const reveal = revealFor(p, maxRevealY)
    for (let column = 0; column < columns; column += 1) {
      const x = width * (0.07 + (column + 0.5) / columns * 0.86)
      const cellWidth = width * 0.7 / columns
      const seed = row * 47 + column * 11
      const unique = row === 3 && column === Math.floor(columns * 0.62)
      const color = unique ? COLORS.gold : (row + column) % 2 === 0 ? COLORS.copper : COLORS.blue
      const motif = (row + column) % 4
      context.save()
      context.translate(x, y)
      context.strokeStyle = rgba(color, reveal * (unique ? 0.52 : 0.2))
      context.lineWidth = unique ? 1.3 : 0.75
      context.beginPath()
      if (motif === 0) {
        context.rect(-cellWidth * 0.27, -16, cellWidth * 0.54, 32)
        context.moveTo(-cellWidth * 0.27, 0)
        context.bezierCurveTo(-cellWidth * 0.08, -20, cellWidth * 0.08, 20, cellWidth * 0.27, 0)
      } else if (motif === 1) {
        for (let ring = 1; ring <= 3; ring += 1) context.ellipse(0, 0, ring * 7, ring * 4.5, ring * 0.22, 0, Math.PI * 2)
      } else if (motif === 2) {
        for (let tick = -2; tick <= 2; tick += 1) {
          context.moveTo(-cellWidth * 0.22, tick * 6)
          context.lineTo(cellWidth * 0.22, tick * 6 + fractalNoise1D(tick + restless * 0.1, seed, 2) * 5)
        }
      } else {
        context.moveTo(-18, 15)
        context.quadraticCurveTo(0, -22 - (unique ? 7 : 0), 18, 15)
        context.moveTo(-14, 8)
        context.lineTo(14, 8)
      }
      context.stroke()
      context.restore()
    }
  }
}

function drawPatternTaxonomy(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
): void {
  if (!visiblePassage(transform, 0.325, 0.46)) return
  const columns = width < 700 ? 6 : 12
  const rows = 9
  for (let row = 0; row < rows; row += 1) {
    const p = 0.354 + row / (rows - 1) * 0.092
    const y = passageY(p, transform)
    if (y < -100 || y > transform.viewportHeight + 100) continue
    const local = localProgress(p * WORLD_HEIGHT, 0.34, 0.46)
    const reveal = revealFor(p, maxRevealY)
    for (let column = 0; column < columns; column += 1) {
      const xBase = width * (0.06 + column / Math.max(1, columns - 1) * 0.88)
      const escape = smoothstep(0.42, 0.96, local) * Math.pow(column / Math.max(1, columns - 1), 2)
      const x = xBase + Math.sin(column * 2.7 + row) * escape * width * 0.055
      const offsetY = Math.cos(column * 1.9 + row) * escape * 34
      const color = column < columns / 2 ? COLORS.copper : COLORS.blue
      const rotation = (column - columns / 2) * 0.05 + escape * (randomAt(row, column) - 0.5)
      context.save()
      context.translate(x, y + offsetY)
      context.rotate(rotation)
      context.strokeStyle = rgba(color, reveal * 0.22)
      context.lineWidth = 0.72
      context.beginPath()
      context.moveTo(-7, -7)
      context.lineTo(7, -7)
      context.lineTo(7, 7)
      context.lineTo(-7, 7)
      if ((row + column) % 3 !== 0 || escape < 0.4) context.closePath()
      context.stroke()
      context.restore()
    }
  }
}

function drawConversation(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
): void {
  if (!visiblePassage(transform, 0.425, 0.55)) return
  for (let index = 0; index < 54; index += 1) {
    const p = 0.443 + index / 53 * 0.098
    const y = passageY(p, transform)
    if (y < -60 || y > transform.viewportHeight + 60) continue
    const reveal = revealFor(p, maxRevealY)
    const fromLeft = index % 2 === 0
    const arrival = smoothstep(0, 1, index / 53)
    const startX = fromLeft ? width * 0.025 : width * 0.975
    const endX = signalPosition(p, width, fromLeft ? -1 : 1, 0, true)
    const dashLength = 5 + randomAt('conversation-dash', index) * 22
    context.strokeStyle = rgba(fromLeft ? COLORS.copper : COLORS.blue, reveal * (0.13 + arrival * 0.1))
    context.lineWidth = 0.7
    context.beginPath()
    context.moveTo(startX, y)
    context.bezierCurveTo(lerp(startX, endX, 0.38), y - 18, lerp(startX, endX, 0.74), y + 18, endX, y)
    context.stroke()
    context.fillStyle = rgba(COLORS.gold, reveal * 0.3)
    context.fillRect((startX + endX) / 2 - dashLength / 2, y - 0.5, dashLength, 1)
  }
}

function drawFearGrid(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
  restless: number,
): void {
  if (!visiblePassage(transform, 0.515, 0.65)) return
  const left = width * 0.055
  const right = width * 0.945
  const columns = width < 700 ? 7 : 14
  for (let row = 0; row < 15; row += 1) {
    const p = 0.545 + row / 14 * 0.096
    const y = passageY(p, transform)
    if (y < -80 || y > transform.viewportHeight + 80) continue
    const reveal = revealFor(p, maxRevealY)
    const fracture = smoothstep(0.32, 0.9, (p - 0.53) / 0.11)
    context.strokeStyle = rgba(nightAt(p) > 0.5 ? COLORS.nightInk : COLORS.ink, reveal * 0.115)
    context.lineWidth = 0.62
    context.beginPath()
    context.moveTo(left, y)
    context.lineTo(right, y + (randomAt(row, Math.floor(restless)) - 0.5) * 9 * fracture)
    context.stroke()
    for (let column = 0; column <= columns; column += 1) {
      const x = lerp(left, right, column / columns)
      const wrong = row === 8 && column === Math.floor(columns * 0.57)
      context.strokeStyle = rgba(wrong ? COLORS.gold : COLORS.ink, reveal * (wrong ? 0.65 : 0.11))
      context.strokeRect(x - 3, y - 4, 6, 6)
      if (!wrong && randomAt(row * 19, column) > 0.24) {
        context.beginPath()
        context.moveTo(x - 2, y - 1)
        context.lineTo(x + 2, y + 1)
        context.stroke()
      }
    }
  }
}

function drawErasures(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
  restless: number,
): void {
  if (!visiblePassage(transform, 0.61, 0.72)) return
  for (let index = 0; index < 27; index += 1) {
    const p = 0.636 + index / 26 * 0.08
    const y = passageY(p, transform)
    if (y < -70 || y > transform.viewportHeight + 70) continue
    const reveal = revealFor(p, maxRevealY)
    const x = width * (0.04 + randomAt('erasure-x', index) * 0.62)
    const length = width * (0.18 + randomAt('erasure-length', index) * 0.45)
    const dark = nightAt(p)
    context.save()
    context.globalCompositeOperation = dark > 0.45 ? 'screen' : 'multiply'
    for (let scrape = 0; scrape < 5; scrape += 1) {
      const jitter = (randomAt(index * 101, scrape + Math.floor(restless)) - 0.5) * 5
      context.strokeStyle = rgba(dark > 0.45 ? COLORS.nightInk : COLORS.bone, reveal * (0.05 + scrape * 0.025))
      context.lineWidth = 2 + scrape * 1.2
      context.beginPath()
      context.moveTo(x, y + jitter)
      context.lineTo(x + length * (0.88 + randomAt(index, scrape) * 0.12), y + jitter + (randomAt(scrape, index) - 0.5) * 5)
      context.stroke()
    }
    context.restore()
    context.strokeStyle = rgba(dark > 0.5 ? COLORS.nightInk : COLORS.ink, reveal * 0.09)
    context.lineWidth = 0.55
    context.setLineDash([2, 7, 1, 11])
    context.strokeRect(x + 3, y - 8, length - 6, 17)
    context.setLineDash([])
  }
}

function drawDeep(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: WorldTransform,
  maxRevealY: number,
): void {
  if (!visiblePassage(transform, 0.68, 0.81)) return
  const visible = getVisibleWorldRange(transform, 120)
  for (let index = 0; index < 150; index += 1) {
    const p = 0.696 + randomAt('deep-y', index) * 0.112
    const worldY = p * WORLD_HEIGHT
    if (worldY < visible.start || worldY > visible.end) continue
    const y = worldToViewportY(worldY, transform)
    const x = width * (0.025 + randomAt('deep-x', index) * 0.95)
    const reveal = markReveal(worldY, maxRevealY, 210)
    const depth = smoothstep(0.69, 0.8, p)
    const color = index % 7 === 0 ? COLORS.gold : index % 2 === 0 ? COLORS.copper : COLORS.blue
    const size = 0.5 + randomAt('deep-size', index) * (1.6 + depth)
    context.fillStyle = rgba(color, reveal * (0.12 + depth * 0.2))
    context.fillRect(x, y, size, size)
    if (index % 11 === 0) {
      context.strokeStyle = rgba(COLORS.nightInk, reveal * 0.085)
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + width * (0.06 + randomAt(index, 4) * 0.2), y + 18 + depth * 50)
      context.stroke()
    }
  }
  const gradient = context.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, rgba(COLORS.night, 0))
  gradient.addColorStop(1, rgba('#07090e', 0.16))
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

function drawPurposeBridge(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
): void {
  if (!visiblePassage(transform, 0.765, 0.9)) return
  const startP = 0.795
  const endP = 0.883
  const bands = width < 700 ? 5 : 9
  for (let band = 0; band < bands; band += 1) {
    const points: Point[] = []
    for (let step = 0; step <= 28; step += 1) {
      const t = step / 28
      const p = lerp(startP, endP, t)
      const y = passageY(p, transform)
      const arch = Math.sin(t * Math.PI)
      const side = band % 2 === 0 ? -1 : 1
      const x = width * (0.5 + side * (0.31 - band / bands * 0.22) * (1 - arch * 0.78))
      points.push({ x, y })
    }
    const reveal = revealFor(lerp(startP, endP, 0.5), maxRevealY)
    organicStroke(context, points, band % 2 === 0 ? COLORS.copper : COLORS.blue, 0.75, reveal * 0.2, 1301 + band)
  }
  for (let step = 0; step < 18; step += 1) {
    if (step === 11) continue
    const p = lerp(startP + 0.007, endP - 0.007, step / 17)
    const y = passageY(p, transform)
    const gap = interpolatedGap(p, width)
    const center = width * 0.5
    context.strokeStyle = rgba(COLORS.gold, revealFor(p, maxRevealY) * 0.36)
    context.lineWidth = 0.78
    context.beginPath()
    context.moveTo(center - gap * 0.92, y)
    context.lineTo(center + gap * 0.92, y)
    context.stroke()
  }
}

function drawAlmostTouch(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
): void {
  if (!visiblePassage(transform, 0.86, 0.955)) return
  for (let index = 0; index < 23; index += 1) {
    const p = 0.884 + index / 22 * 0.065
    const y = passageY(p, transform)
    if (y < -150 || y > transform.viewportHeight + 150) continue
    const reveal = revealFor(p, maxRevealY)
    const local = (p - 0.88) / 0.07
    const radiusX = width * (0.045 + index * 0.006)
    const radiusY = 12 + index * 3.7
    const center = width * (0.5 + Math.sin(index * 1.7) * 0.006)
    context.strokeStyle = rgba(index % 2 === 0 ? COLORS.copper : COLORS.blue, reveal * (0.12 + local * 0.055))
    context.lineWidth = 0.65
    context.beginPath()
    context.ellipse(center, y, radiusX, radiusY, index * 0.025, 0, Math.PI * 2)
    context.stroke()
  }
}

function drawFinalSingularities(
  context: CanvasRenderingContext2D,
  width: number,
  transform: WorldTransform,
  maxRevealY: number,
  restless: number,
): void {
  if (!visiblePassage(transform, 0.925, 1, 0.01)) return
  const columns = width < 700 ? 5 : 9
  for (let row = 0; row < 8; row += 1) {
    const p = 0.943 + row / 7 * 0.05
    const y = passageY(p, transform)
    if (y < -100 || y > transform.viewportHeight + 100) continue
    const local = smoothstep(0.94, 1, p)
    const reveal = revealFor(p, maxRevealY)
    for (let column = 0; column < columns; column += 1) {
      const x = width * (0.08 + column / Math.max(1, columns - 1) * 0.84)
      const individuality = fractalNoise1D(column * 0.8 + row * 1.4 + restless * 0.03, 1501 + row, 2) * local
      const radius = 3 + ((column + row) % 4) * 2.3
      context.save()
      context.translate(x + individuality * 16, y + individuality * 8)
      context.rotate(individuality)
      context.strokeStyle = rgba((row + column) % 2 === 0 ? COLORS.copper : COLORS.blue, reveal * (0.16 + local * 0.13))
      context.lineWidth = 0.72
      context.beginPath()
      context.moveTo(0, -radius * (1 + individuality * 0.4))
      context.lineTo(radius * (1 + individuality), 0)
      context.lineTo(0, radius * (1 - individuality * 0.2))
      context.lineTo(-radius * (1 - individuality), 0)
      context.closePath()
      context.stroke()
      context.restore()
    }
  }

  const finalY = passageY(0.998, transform)
  const reveal = revealFor(0.997, maxRevealY)
  if (finalY > -60 && finalY < transform.viewportHeight + 60) {
    const x = width * 0.5
    context.save()
    context.shadowColor = rgba(COLORS.gold, reveal * 0.9)
    context.shadowBlur = 28 * reveal
    context.fillStyle = rgba(COLORS.gold, reveal)
    context.beginPath()
    context.arc(x, finalY, 2.7, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }
}

function drawPointerTrail(context: CanvasRenderingContext2D, trail: readonly TrailPoint[], now: number): void {
  if (trail.length < 2) return
  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1]
    const point = trail[index]
    const age = now - point.at
    const life = 1 - clamp(age / 3_800)
    if (life <= 0) continue
    context.strokeStyle = rgba(COLORS.ink, life * 0.16)
    context.lineWidth = 0.45 + life * 0.55
    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.quadraticCurveTo((previous.x + point.x) / 2, (previous.y + point.y) / 2, point.x, point.y)
    context.stroke()
  }
  const tip = trail[trail.length - 1]
  const tipLife = 1 - clamp((now - tip.at) / 3_800)
  context.fillStyle = rgba(COLORS.gold, tipLife * 0.42)
  context.beginPath()
  context.arc(tip.x, tip.y, 1.25, 0, Math.PI * 2)
  context.fill()
}

function drawWorld(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: WorldTransform,
  maxRevealY: number,
  now: number,
  reducedMotion: boolean,
  trail: readonly TrailPoint[],
  mobile: boolean,
  velocity: number,
): void {
  const progress = clamp(transform.scrollY / Math.max(1, transform.documentHeight))
  const restless = reducedMotion ? 0 : Math.floor(now / 3_200)
  const fastScroll = !reducedMotion && velocity > 0.46
  drawBackdrop(context, width, height, progress, fastScroll)
  if (!fastScroll) drawField(context, transform, width, maxRevealY, progress, restless, mobile, false)
  if (!fastScroll) {
    drawFirstPressure(context, width, transform, maxRevealY)
    drawLanguageSediment(context, width, transform, maxRevealY, restless)
    drawDrafts(context, width, transform, maxRevealY, restless)
    drawLoveStudies(context, width, transform, maxRevealY, restless)
    drawPatternTaxonomy(context, width, transform, maxRevealY)
    drawConversation(context, width, transform, maxRevealY)
    drawFearGrid(context, width, transform, maxRevealY, restless)
    drawErasures(context, width, transform, maxRevealY, restless)
    drawDeep(context, width, height, transform, maxRevealY)
    drawPurposeBridge(context, width, transform, maxRevealY)
    drawAlmostTouch(context, width, transform, maxRevealY)
    drawFinalSingularities(context, width, transform, maxRevealY, restless)
  }
  drawSignals(context, width, height, transform, maxRevealY, now, reducedMotion, trail[trail.length - 1], fastScroll)
  if (!reducedMotion) drawPointerTrail(context, trail, now)
}

export function WorldCanvas({ frameRef, onUiFrame }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    let reducedMotion = motionQuery.matches
    let width = 1
    let height = 1
    let dpr = 1
    let animationFrame = 0
    let previousScrollY = window.scrollY
    let filteredVelocity = 0
    let maxRevealY = 0
    let lastUiKey = ''
    let lastDrawnScroll = -1
    let lastPaintAt = -Infinity
    let previousTime = performance.now()
    let visible = !document.hidden
    const trail: TrailPoint[] = []

    const resize = () => {
      width = Math.max(1, window.innerWidth)
      height = Math.max(1, window.innerHeight)
      dpr = Math.min(width < 720 ? 1.5 : 2, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      lastDrawnScroll = -1
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointerQuery.matches || reducedMotion || event.pointerType === 'touch') return
      const now = performance.now()
      const previous = trail[trail.length - 1]
      if (previous && Math.hypot(previous.x - event.clientX, previous.y - event.clientY) < 3 && now - previous.at < 45) return
      trail.push({ x: event.clientX, y: event.clientY, at: now })
      if (trail.length > 110) trail.splice(0, trail.length - 110)
    }

    const onMotionChange = () => {
      reducedMotion = motionQuery.matches
      if (reducedMotion) trail.length = 0
      lastDrawnScroll = -1
    }

    const onVisibility = () => {
      visible = !document.hidden
      if (visible) {
        previousTime = performance.now()
        animationFrame = requestAnimationFrame(render)
      } else {
        cancelAnimationFrame(animationFrame)
      }
    }

    const render = (now: number) => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - height)
      const scrollY = clamp(window.scrollY, 0, scrollable)
      const deltaTime = Math.max(8, Math.min(64, now - previousTime))
      const instantVelocity = Math.abs(scrollY - previousScrollY) / deltaTime
      filteredVelocity = lerp(filteredVelocity, clamp(instantVelocity / 2.2), 0.12)
      previousScrollY = scrollY
      previousTime = now

      const transform: WorldTransform = {
        worldHeight: WORLD_HEIGHT,
        documentHeight: scrollable,
        viewportHeight: height,
        scrollY,
      }
      maxRevealY = reducedMotion
        ? WORLD_HEIGHT
        : advanceMaxRevealY(maxRevealY, revealCandidateY(transform, 0.88), WORLD_HEIGHT)

      const progress = clamp(scrollY / scrollable)
      const passageIndex = getPassageIndex(progress)
      const passage = passages[passageIndex]
      const visibleRange = getVisibleWorldRange(transform)
      const previousProgress = frameRef.current.progress
      const frame: WorldFrame = {
        progress,
        previousProgress,
        localProgress: getLocalPassageProgress(progress, passage),
        passageIndex,
        scrollY,
        worldHeight: WORLD_HEIGHT,
        viewportWidth: width,
        viewportHeight: height,
        visibleTop: visibleRange.start,
        visibleBottom: visibleRange.end,
        maxRevealY,
        velocity: filteredVelocity,
        timeMs: now,
        pointer: {
          x: trail.length > 0 ? trail[trail.length - 1].x / width : 0.5,
          y: trail.length > 0 ? trail[trail.length - 1].y / height : 0.5,
          active: trail.length > 0 && now - trail[trail.length - 1].at < 3_800,
          trail: trail.map((point) => ({ x: point.x / width, y: point.y / height, timeMs: point.at })),
        },
        reducedMotion,
        profile: interpolatePassageProfiles(progress),
      }
      frameRef.current = frame

      const uiKey = `${frame.passageIndex}:${progress > 0.055}:${frame.profile.visual.night > 0.5}`
      if (uiKey !== lastUiKey) {
        lastUiKey = uiKey
        onUiFrame?.(frame)
      }

      const restlessChanged = !reducedMotion && Math.floor(now / 3_200) !== Math.floor((now - deltaTime) / 3_200)
      const trailActive = trail.some((point) => now - point.at < 3_800)
      const shouldDraw = !reducedMotion || lastDrawnScroll !== scrollY || restlessChanged || trailActive
      const fastScroll = !reducedMotion && filteredVelocity > 0.46
      const paintDue = !fastScroll || now - lastPaintAt >= 29
      if (shouldDraw && paintDue) {
        while (trail.length > 0 && now - trail[0].at > 3_800) trail.shift()
        context.setTransform(dpr, 0, 0, dpr, 0, 0)
        context.clearRect(0, 0, width, height)
        drawWorld(context, width, height, transform, maxRevealY, now, reducedMotion, trail, width < 720, filteredVelocity)
        lastDrawnScroll = scrollY
        lastPaintAt = now
      }
      if (visible) animationFrame = requestAnimationFrame(render)
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    motionQuery.addEventListener('change', onMotionChange)
    animationFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibility)
      motionQuery.removeEventListener('change', onMotionChange)
    }
  }, [frameRef, onUiFrame])

  return <canvas ref={canvasRef} className="world-canvas" aria-hidden="true" />
}
