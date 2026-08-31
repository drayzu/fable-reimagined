import { useEffect, useRef, useState } from 'react'
import {
  FABLE_WORLD_HEIGHT,
  FABLE_WORLD_WIDTH,
  attentionThreadX,
  livingMotifs,
} from './fableAliveWorld'

type Random = () => number

interface FlockBird {
  homeX: number
  homeY: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  angle: number
  homeAngle: number
  depth: number
  clusterAngle: number
  clusterRadius: number
  pathIndex: number
  pathOffset: number
  gold?: boolean
}

interface PaperGrain {
  x: number
  y: number
  size: number
  light: boolean
}

interface RainSeed {
  x: number
  y: number
  length: number
  speed: number
  phase: number
  opacity: number
}

interface LetterGlyph {
  x: number
  y: number
  seed: number
  phase: number
  rate: number
  color: 'ink' | 'clay' | 'slate'
}

interface MazeKeyframe {
  at: number
  x: number
  y: number
  alpha?: number
}

const SAGE_PAPER = [223, 226, 206] as const
const CREAM_PAPER = [246, 241, 228] as const
const INK = '#2a251f'
const OCHRE = '#9b7228'
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const LETTER_CANVAS_TOP = 2520
const LETTER_CANVAS_HEIGHT = 970
const FLOCK_CANVAS_TOP = 4680
const FLOCK_CANVAS_HEIGHT = 1360
const MAZE_CANVAS_TOP = 6880
const MAZE_CANVAS_HEIGHT = 280

const MAZE_START = { x: 437, y: 6951 } as const
const MAZE_ROUTE_DURATION = 26
const MAZE_ROUTE: readonly MazeKeyframe[] = [
  { at: 0, ...MAZE_START },
  { at: 1.2, ...MAZE_START },
  // First thought: the upper corridor closes against the central wall.
  { at: 2.45, x: 383, y: 6951 },
  { at: 3.05, x: 383, y: 6951 },
  { at: 4.15, ...MAZE_START },
  // Second thought: a short horizontal chamber offers no continuation.
  { at: 5.35, x: 437, y: 6997 },
  { at: 6.15, x: 409, y: 6997 },
  { at: 6.7, x: 409, y: 6997 },
  { at: 7.4, x: 437, y: 6997 },
  // The mark descends into the centre and tests another sealed stem.
  { at: 8.15, x: 437, y: 7021 },
  { at: 9.35, x: 388, y: 7021 },
  { at: 10.55, x: 388, y: 7066 },
  { at: 11.2, x: 364, y: 7066 },
  { at: 12.15, x: 364, y: 7041 },
  { at: 12.75, x: 364, y: 7041 },
  { at: 13.55, x: 364, y: 7066 },
  // A convincing lower route is also a dead end.
  { at: 14.35, x: 364, y: 7089 },
  { at: 15.55, x: 316, y: 7089 },
  { at: 16.15, x: 316, y: 7094 },
  { at: 16.8, x: 316, y: 7094 },
  { at: 17.75, x: 316, y: 7048 },
  // Only after returning does the opening on the left become visible.
  { at: 19.05, x: 269, y: 7048 },
  { at: 20.45, x: 269, y: 7112 },
  { at: 21.65, x: 269, y: 7112 },
  { at: 22.55, x: 269, y: 7112, alpha: 0 },
  { at: 23.25, ...MAZE_START, alpha: 0 },
  { at: 24.2, ...MAZE_START, alpha: 1 },
  { at: MAZE_ROUTE_DURATION, ...MAZE_START },
]

function mulberry32(seed: number): Random {
  return () => {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed)
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
  }
}

function makeRain(): RainSeed[] {
  const random = mulberry32(7321)
  return Array.from({ length: 92 }, () => ({
    x: 100 + random() * 1400,
    y: 3610 + random() * 980,
    length: 12 + random() * 34,
    speed: 22 + random() * 34,
    phase: random(),
    opacity: 0.08 + random() * 0.18,
  }))
}

function insideLetterPerson(x: number, y: number): boolean {
  const headX = (x - 600) / 194
  const headY = (y - 2868) / 188
  if (headX * headX + headY * headY < 1) return true
  if (y < 3020 || y > 3448) return false
  const progress = Math.max(0, Math.min(1, (y - 3020) / 428))
  const halfWidth = 86 + (410 - 86) * Math.pow(progress, 0.58)
  return Math.abs(x - 600) < halfWidth
}

function makeLetterGlyphs(): LetterGlyph[] {
  const random = mulberry32(9307)
  const glyphs: LetterGlyph[] = []
  // Stop two baselines before the page join so the figure ends with a little
  // more air above the blush sheet.
  for (let y = 2620; y < 3402; y += 34) {
    for (let x = 180; x < 1040; x += 32) {
      if (!insideLetterPerson(x + 8, y - 10)) continue
      const accent = random()
      glyphs.push({
        x,
        y,
        seed: Math.floor(random() * 26),
        phase: random() * 4 + y * 0.0018 - x * 0.0007,
        rate: 1.35 + random() * 1.25,
        color: accent < 0.07 ? 'clay' : accent < 0.13 ? 'slate' : 'ink',
      })
    }
  }
  return glyphs
}

function flockCurve(t: number): readonly [number, number] {
  return [
    250 + 1150 * t,
    5060 + 520 * t + 260 * Math.sin(t * 3.6 - 0.6) * (1 - t * 0.4),
  ]
}

function flockAngle(t: number): number {
  const before = flockCurve(Math.max(0, t - 0.006))
  const after = flockCurve(Math.min(1, t + 0.006))
  return Math.atan2(after[1] - before[1], after[0] - before[0])
}

function uprightAngle(angle: number): number {
  let normalized = Math.atan2(Math.sin(angle), Math.cos(angle))
  if (normalized > Math.PI / 2) normalized -= Math.PI
  if (normalized < -Math.PI / 2) normalized += Math.PI
  return normalized
}

function easeInOut(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function mazePose(seconds: number): { x: number; y: number; alpha: number } {
  const time = ((seconds % MAZE_ROUTE_DURATION) + MAZE_ROUTE_DURATION) % MAZE_ROUTE_DURATION
  let index = 0
  while (index < MAZE_ROUTE.length - 2 && MAZE_ROUTE[index + 1].at < time) index += 1
  const start = MAZE_ROUTE[index]
  const end = MAZE_ROUTE[index + 1]
  const amount = easeInOut((time - start.at) / Math.max(0.001, end.at - start.at))
  return {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
    alpha: (start.alpha ?? 1) + ((end.alpha ?? 1) - (start.alpha ?? 1)) * amount,
  }
}

function mixPoint(
  start: readonly [number, number],
  end: readonly [number, number],
  amount: number,
): readonly [number, number] {
  const t = easeInOut(amount)
  return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]
}

function infinityPoint(bird: FlockBird, flow: number): readonly [number, number] {
  const densityWarp = Math.sin((bird.pathIndex * 2.2 - flow * 1.7) * Math.PI * 2) * 0.024
    + Math.sin((bird.pathIndex * 5.1 + flow) * Math.PI * 2) * 0.008
  const theta = (bird.pathIndex + flow + densityWarp) * Math.PI * 2
  const sine = Math.sin(theta)
  const cosine = Math.cos(theta)
  const breath = Math.sin(flow * Math.PI * 2)
  const centerX = 815 + Math.sin(flow * Math.PI * 4) * 9
  const centerY = 5365 + Math.cos(flow * Math.PI * 2) * 7
  const width = 515 * (1 + breath * 0.035)
  const height = 390 * (1 - breath * 0.055)
  const baseX = centerX + sine * width
  const baseY = centerY + sine * cosine * height
  const tangentX = cosine * width
  const tangentY = Math.cos(theta * 2) * height
  const tangentLength = Math.max(1, Math.hypot(tangentX, tangentY))
  const normalX = -tangentY / tangentLength
  const normalY = tangentX / tangentLength
  const breathing = 1 + Math.sin(theta * 3 + flow * Math.PI * 2) * 0.12
  const thickness = bird.pathOffset * breathing
  return [baseX + normalX * thickness, baseY + normalY * thickness]
}

function choreographyPoint(bird: FlockBird, progress: number): readonly [number, number] {
  // A cluster is a stable field, not an orbit. Its marks may breathe, but its
  // destinations must not keep rotating or the flock reads as trembling.
  const angle = bird.clusterAngle + 0.46 + bird.depth * 0.12
  const radius = 4 + bird.clusterRadius * 270
  const cloudEdge = 1 + Math.sin(bird.clusterAngle * 3.1) * 0.12
  const ribbon: readonly [number, number] = [bird.homeX, bird.homeY]
  const cluster: readonly [number, number] = [
    815 + Math.cos(angle + Math.sin(angle * 2.4) * 0.08) * radius * cloudEdge * 1.08,
    5370 + Math.sin(angle) * radius / cloudEdge * 0.68,
  ]
  const finalCluster: readonly [number, number] = [
    815 + Math.cos(angle + 0.8) * radius * 0.68,
    5370 + Math.sin(angle + 0.8) * radius * 0.46,
  ]

  if (progress < 0.17) return mixPoint(ribbon, cluster, progress / 0.17)
  if (progress < 0.3) {
    const pulse = 1 + Math.sin((progress - 0.17) / 0.13 * Math.PI) * 0.11
    return [815 + (cluster[0] - 815) * pulse, 5370 + (cluster[1] - 5370) * pulse]
  }
  const infinityStart = infinityPoint(bird, 0)
  if (progress < 0.45) return mixPoint(cluster, infinityStart, (progress - 0.3) / 0.15)
  if (progress < 0.76) {
    const travel = easeInOut((progress - 0.45) / 0.31) * 1.18
    return infinityPoint(bird, travel)
  }
  const infinityEnd = infinityPoint(bird, 1.18)
  if (progress < 0.87) return mixPoint(infinityEnd, finalCluster, (progress - 0.76) / 0.11)
  return mixPoint(finalCluster, ribbon, (progress - 0.87) / 0.13)
}

function makeFlock(): FlockBird[] {
  const random = mulberry32(4047)
  const flock: FlockBird[] = []
  for (let index = 0; index < 430; index += 1) {
    const t = Math.max(0, Math.min(1, random() * random() * 0.25 + random() * 0.85))
    const [curveX, curveY] = flockCurve(t)
    const angle = flockAngle(t)
    const width = 42 + 175 * Math.pow(Math.sin(Math.PI * t) + 0.001, 1.2) * (0.58 + 0.42 * Math.sin(t * 6.3 + 1))
    const offset = (random() + random() + random() - 1.5) / 1.5 * width
    const homeX = curveX - Math.sin(angle) * offset + (random() - 0.5) * 26
    const homeY = curveY + Math.cos(angle) * offset + (random() - 0.5) * 18
    const depth = random()
    const clusterAngle = random() * Math.PI * 2
    const homeAngle = uprightAngle(angle + (random() - 0.5) * 0.24)
    flock.push({
      homeX,
      homeY,
      x: homeX,
      y: homeY,
      vx: 0,
      vy: 0,
      size: depth < 0.2 ? 2.6 + random() * 1.8 : 4.2 + random() * 5.6,
      phase: random() * Math.PI * 2,
      angle: homeAngle,
      homeAngle,
      depth,
      clusterAngle,
      clusterRadius: Math.pow(random(), 1.45),
      pathIndex: index / 430,
      pathOffset: (random() + random() - 1) * (16 + depth * 26),
    })
  }
  flock.push({
    homeX: 700,
    homeY: 5380,
    x: 700,
    y: 5380,
    vx: 0,
    vy: 0,
    size: 9,
    phase: 1.3,
    angle: uprightAngle(flockAngle(0.38)),
    homeAngle: uprightAngle(flockAngle(0.38)),
    depth: 1,
    clusterAngle: 1.8,
    clusterRadius: 0.48,
    pathIndex: 0.618,
    pathOffset: -10,
    gold: true,
  })
  return flock
}

function makePaperGrain(): PaperGrain[] {
  const random = mulberry32(1889)
  return Array.from({ length: 520 }, () => {
    const t = random()
    const [x, y] = flockCurve(t)
    return {
      x: x + (random() - 0.5) * 390,
      y: y + (random() - 0.5) * 330,
      size: 0.25 + random() * 0.85,
      light: random() > 0.6,
    }
  })
}

const rain = makeRain()
const paperGrain = makePaperGrain()
const letterGlyphs = makeLetterGlyphs()

function drawBird(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  flap: number,
  color: string,
  alpha: number,
) {
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  context.strokeStyle = color
  context.globalAlpha = alpha
  context.lineWidth = Math.max(0.9, size * 0.2)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(-size, 0)
  context.quadraticCurveTo(-size * 0.45, -size * flap, 0, 0)
  context.quadraticCurveTo(size * 0.45, -size * flap, size, 0)
  context.stroke()
  context.restore()
}

function drawFlockCleanPlate(context: CanvasRenderingContext2D) {
  context.save()
  // The flock lives on the sage sheet. Never let its reversible clean plate
  // paint across the torn join or the shadow cast by the blush page above.
  context.beginPath()
  context.rect(30, 4820, 1540, 1110)
  context.clip()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  for (let step = 0; step <= 70; step += 1) {
    // Stop just before the torn paper edge so the reversible clean plate never
    // paints over the wall's shadow.
    const t = 0.015 + step / 70 * 0.925
    const [x, y] = flockCurve(t)
    if (step === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.strokeStyle = `rgb(${SAGE_PAPER.join(',')})`
  context.lineWidth = 366
  context.stroke()

  for (const grain of paperGrain) {
    context.fillStyle = grain.light ? 'rgba(255,252,238,0.035)' : 'rgba(58,58,44,0.022)'
    context.fillRect(grain.x, grain.y, grain.size, grain.size)
  }

  // The clean plate removes a short part of the baked thread as collateral;
  // redraw that original material before placing the living flock above it.
  context.beginPath()
  for (let y = 4740; y <= 5930; y += 9) {
    const x = attentionThreadX(y)
    if (y === 4740) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.strokeStyle = 'rgba(156,120,56,0.62)'
  context.lineWidth = 1.7
  context.stroke()
  context.restore()
}

function drawLetterPerson(context: CanvasRenderingContext2D, seconds: number) {
  context.save()
  context.beginPath()
  context.rect(150, 2588, 910, 858)
  context.clip()

  // Lift only the original typographic bust; surrounding annotations, thread,
  // spatter and the blush-page join remain part of the immutable wall.
  context.fillStyle = `rgb(${CREAM_PAPER.join(',')})`
  context.beginPath()
  context.ellipse(600, 2862, 222, 232, 0, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.moveTo(514, 3010)
  context.lineTo(486, 3100)
  context.lineTo(398, 3180)
  context.lineTo(186, 3450)
  context.lineTo(1014, 3450)
  context.lineTo(802, 3180)
  context.lineTo(714, 3100)
  context.lineTo(686, 3010)
  context.closePath()
  context.fill()

  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.font = '500 28px "Shantell Sans", cursive'
  for (const glyph of letterGlyphs) {
    const cycle = seconds * glyph.rate + glyph.phase
    const step = Math.floor(cycle)
    const fraction = cycle - step
    const current = LETTERS[(glyph.seed + step * 7) % LETTERS.length]
    const next = LETTERS[(glyph.seed + (step + 1) * 7) % LETTERS.length]
    const color = glyph.color === 'clay'
      ? [172, 80, 54]
      : glyph.color === 'slate'
        ? [88, 112, 148]
        : [42, 37, 31]
    const transition = easeInOut(Math.max(0, (fraction - 0.68) / 0.32))
    context.fillStyle = `rgba(${color.join(',')},${0.82 * (1 - transition)})`
    context.fillText(current, glyph.x, glyph.y)
    if (transition > 0) {
      context.fillStyle = `rgba(${color.join(',')},${0.82 * transition})`
      context.fillText(next, glyph.x, glyph.y)
    }
  }

  // Rebuild the small heart spark above the changing alphabet.
  const heartX = 600
  const heartY = 3152
  context.strokeStyle = 'rgba(172,80,54,0.9)'
  context.lineWidth = 1.8
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = ray / 8 * Math.PI * 2 + 0.08
    const inner = 7 + (ray % 2) * 2
    const outer = 20 + (ray % 3) * 2
    context.beginPath()
    context.moveTo(heartX + Math.cos(angle) * inner, heartY + Math.sin(angle) * inner)
    context.lineTo(heartX + Math.cos(angle) * outer, heartY + Math.sin(angle) * outer)
    context.stroke()
  }
  context.fillStyle = 'rgba(88,112,148,0.9)'
  context.beginPath()
  context.arc(heartX, heartY, 3.2, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function drawMazeRunner(context: CanvasRenderingContext2D, seconds: number) {
  // Remove only the baked Claude spark. It sits safely inside the upper-right
  // chamber, so this tiny clean plate never crosses a maze wall.
  context.fillStyle = `rgb(${CREAM_PAPER.join(',')})`
  context.beginPath()
  context.ellipse(MAZE_START.x, MAZE_START.y, 11.5, 11.5, 0, 0, Math.PI * 2)
  context.fill()

  const pose = mazePose(seconds)
  const previous = mazePose(seconds - 0.12)
  const speed = Math.hypot(pose.x - previous.x, pose.y - previous.y)
  const pulse = 1 + Math.sin(seconds * 5.2) * (speed < 0.18 ? 0.07 : 0.025)

  // A few receding flecks make the traversal readable without drawing a
  // permanent solution over the original labyrinth.
  for (let echo = 4; echo >= 1; echo -= 1) {
    const earlier = mazePose(seconds - echo * 0.085)
    context.fillStyle = `rgba(177,78,55,${earlier.alpha * (5 - echo) * 0.018})`
    context.beginPath()
    context.arc(earlier.x, earlier.y, 0.9 + (4 - echo) * 0.12, 0, Math.PI * 2)
    context.fill()
  }

  context.save()
  context.translate(pose.x, pose.y)
  context.rotate(Math.sin(seconds * 1.15) * 0.055)
  context.scale(pulse, pulse)
  context.strokeStyle = `rgba(177,78,55,${0.92 * pose.alpha})`
  context.fillStyle = `rgba(177,78,55,${0.86 * pose.alpha})`
  context.lineWidth = 1.35
  context.lineCap = 'round'
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = ray / 8 * Math.PI * 2 + 0.075
    const inner = 3.1 + (ray % 2) * 0.45
    const outer = 7.2 + (ray % 3) * 0.9
    context.beginPath()
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    context.quadraticCurveTo(
      Math.cos(angle + 0.055) * (inner + outer) * 0.53,
      Math.sin(angle + 0.055) * (inner + outer) * 0.53,
      Math.cos(angle) * outer,
      Math.sin(angle) * outer,
    )
    context.stroke()
  }
  context.beginPath()
  context.arc(0, 0, 1.45, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function FableLivingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const letterCanvasRef = useRef<HTMLCanvasElement>(null)
  const flockCanvasRef = useRef<HTMLCanvasElement>(null)
  const mazeCanvasRef = useRef<HTMLCanvasElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [motionOverride, setMotionOverride] = useState(false)
  const motionEnabled = !prefersReducedMotion || motionOverride

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(query.matches)
    query.addEventListener('change', updatePreference)
    return () => query.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const letterCanvas = letterCanvasRef.current
    const flockCanvas = flockCanvasRef.current
    const mazeCanvas = mazeCanvasRef.current
    if (!canvas || !letterCanvas || !flockCanvas || !mazeCanvas) return
    const context = canvas.getContext('2d')
    const letterContext = letterCanvas.getContext('2d')
    const flockContext = flockCanvas.getContext('2d')
    const mazeContext = mazeCanvas.getContext('2d')
    if (!context || !letterContext || !flockContext || !mazeContext) return

    const flock = makeFlock()
    const flockMotion = { energy: 0 }
    const pointer = { x: -10_000, y: -10_000, active: false }
    let flightStartedAt = -1
    let frame = 0
    let width = 0
    let height = 0
    let dpr = 1
    let lastTime = performance.now()
    let letterPainted = false
    let flockPainted = false
    let mazePainted = false
    let mazeStartedAt = -1

    const sizeRegisteredCanvas = (
      registeredCanvas: HTMLCanvasElement,
      worldHeight: number,
    ) => {
      const scale = width / FABLE_WORLD_WIDTH
      const cssHeight = worldHeight * scale
      registeredCanvas.width = Math.max(1, Math.round(width * dpr))
      registeredCanvas.height = Math.max(1, Math.round(cssHeight * dpr))
      registeredCanvas.style.width = `${width}px`
      registeredCanvas.style.height = `${cssHeight}px`
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(width < 700 ? 1.5 : 2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      sizeRegisteredCanvas(letterCanvas, LETTER_CANVAS_HEIGHT)
      sizeRegisteredCanvas(flockCanvas, FLOCK_CANVAS_HEIGHT)
      sizeRegisteredCanvas(mazeCanvas, MAZE_CANVAS_HEIGHT)
      letterPainted = false
      flockPainted = false
      mazePainted = false
    }

    const updatePointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.active = true
      const scale = window.innerWidth / FABLE_WORLD_WIDTH
      const worldX = event.clientX / scale
      const worldY = window.scrollY / scale + event.clientY / scale
      document.body.classList.toggle(
        'fable-flock-clickable',
        motionEnabled && worldX > 60 && worldX < 1540 && worldY > 4700 && worldY < 5980,
      )
    }
    const clearPointer = () => {
      pointer.active = false
      document.body.classList.remove('fable-flock-clickable')
    }
    const triggerFlight = (event: PointerEvent) => {
      if (!motionEnabled) return
      const scale = window.innerWidth / FABLE_WORLD_WIDTH
      const worldX = event.clientX / scale
      const worldY = window.scrollY / scale + event.clientY / scale
      if (worldX > 60 && worldX < 1540 && worldY > 4700 && worldY < 5980) {
        flightStartedAt = performance.now()
      }
    }

    const render = (now: number) => {
      const delta = Math.min(48, now - lastTime)
      lastTime = now
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      if (motionEnabled && !document.hidden) {
        const scale = width / FABLE_WORLD_WIDTH
        const scrollWorldY = window.scrollY / scale
        const viewportWorldHeight = height / scale
        const visibleStart = Math.max(0, scrollWorldY - 120)
        const visibleEnd = Math.min(FABLE_WORLD_HEIGHT, scrollWorldY + viewportWorldHeight + 120)
        const worldToScreenX = (x: number) => x * scale
        const worldToScreenY = (y: number) => (y - scrollWorldY) * scale
        const seconds = now / 1000

        const letterIsVisible = visibleEnd >= LETTER_CANVAS_TOP
          && visibleStart <= LETTER_CANVAS_TOP + LETTER_CANVAS_HEIGHT
        if (!letterPainted || letterIsVisible) {
          letterContext.setTransform(1, 0, 0, 1, 0, 0)
          letterContext.clearRect(0, 0, letterCanvas.width, letterCanvas.height)
          letterContext.setTransform(dpr * scale, 0, 0, dpr * scale, 0, -LETTER_CANVAS_TOP * dpr * scale)
          drawLetterPerson(letterContext, seconds)
          letterPainted = true
        }

        // A quiet travelling glint follows the exact baked attention thread.
        const pulseWorldY = scrollWorldY + ((seconds * 0.16) % 1) * viewportWorldHeight
        const pulseSpan = Math.max(92, viewportWorldHeight * 0.115)
        context.lineCap = 'round'
        for (let pass = 0; pass < 2; pass += 1) {
          context.beginPath()
          let started = false
          for (let y = Math.max(visibleStart, pulseWorldY - pulseSpan); y <= Math.min(visibleEnd, pulseWorldY + pulseSpan); y += 7) {
            const distance = Math.abs(y - pulseWorldY) / pulseSpan
            if (distance > 1) continue
            const x = worldToScreenX(attentionThreadX(y))
            const screenY = worldToScreenY(y)
            if (!started) { context.moveTo(x, screenY); started = true } else context.lineTo(x, screenY)
          }
          context.strokeStyle = pass === 0 ? 'rgba(235,202,119,0.07)' : 'rgba(246,219,146,0.48)'
          context.lineWidth = (pass === 0 ? 4.5 : 1.05) * Math.max(0.72, scale)
          context.stroke()
        }
        const pulseX = worldToScreenX(attentionThreadX(pulseWorldY))
        const pulseY = worldToScreenY(pulseWorldY)
        context.fillStyle = 'rgba(247,221,151,0.72)'
        context.beginPath()
          context.arc(pulseX, pulseY, Math.max(1.3, scale * 2.1), 0, Math.PI * 2)
        context.fill()

        // Rain only exists over the garden; its diagonal changes almost
        // imperceptibly with the visitor's inspection point.
        if (visibleEnd >= 3420 && visibleStart <= 4800) {
          const lean = pointer.active ? Math.max(-0.2, Math.min(0.2, (pointer.x / width - 0.5) * 0.28)) : 0.04
          context.lineWidth = Math.max(0.45, scale * 0.8)
          context.lineCap = 'round'
          for (const drop of rain) {
            const cycle = ((seconds * drop.speed + drop.phase * 1040) % 1040)
            const worldY = 3610 + cycle
            if (worldY < visibleStart || worldY > visibleEnd) continue
            const x = worldToScreenX(drop.x + Math.sin(seconds * 0.32 + drop.phase * 8) * 4)
            const y = worldToScreenY(worldY)
            const length = drop.length * scale
            context.strokeStyle = `rgba(77,104,132,${drop.opacity})`
            context.beginPath()
            context.moveTo(x, y)
            context.lineTo(x + length * lean, y + length)
            context.stroke()
          }
        }

        // The printed flock is replaced, reversibly, by a collective body.
        const flockIsVisible = visibleEnd >= FLOCK_CANVAS_TOP
          && visibleStart <= FLOCK_CANVAS_TOP + FLOCK_CANVAS_HEIGHT
        if (!flockPainted || flockIsVisible) {
          flockContext.setTransform(1, 0, 0, 1, 0, 0)
          flockContext.clearRect(0, 0, flockCanvas.width, flockCanvas.height)
          flockContext.setTransform(dpr * scale, 0, 0, dpr * scale, 0, -FLOCK_CANVAS_TOP * dpr * scale)
          drawFlockCleanPlate(flockContext)

          const frameScale = Math.max(0.35, Math.min(2.8, delta / 16.667))
          const flightDuration = 15_500
          const flightProgress = flightStartedAt < 0 ? 0 : Math.min(1, (now - flightStartedAt) / flightDuration)
          if (flightProgress >= 1) flightStartedAt = -1
          const flightEnergy = flightStartedAt < 0 ? 0 : Math.sin(Math.PI * flightProgress)
          flockMotion.energy += (flightEnergy - flockMotion.energy) * (flightStartedAt < 0 ? 0.02 : 0.075) * frameScale

          let averageVelocityX = 0
          let averageVelocityY = 0
          for (const bird of flock) {
            averageVelocityX += bird.vx
            averageVelocityY += bird.vy
          }
          averageVelocityX /= flock.length
          averageVelocityY /= flock.length

          for (const bird of flock) {
            const orbitAngle = bird.phase + seconds * (0.11 + bird.depth * 0.08)
            const agitation = flockMotion.energy
            const choreography = flightStartedAt < 0
              ? [bird.homeX, bird.homeY] as const
              : choreographyPoint(bird, Math.max(0, Math.min(1, flightProgress - bird.depth * 0.018)))
            const idleDrift = flightStartedAt < 0 ? 2.2 : 1.2
            const targetX = choreography[0] + Math.cos(orbitAngle) * idleDrift
            const targetY = choreography[1] + Math.sin(orbitAngle) * idleDrift

            bird.vx += ((targetX - bird.x) * (0.018 + agitation * 0.009)
              + (averageVelocityX - bird.vx) * 0.06) * frameScale
            bird.vy += ((targetY - bird.y) * (0.018 + agitation * 0.009)
              + (averageVelocityY - bird.vy) * 0.06) * frameScale
            const damping = Math.pow(0.875 - agitation * 0.018, frameScale)
            bird.vx *= damping
            bird.vy *= damping
            bird.x += bird.vx * frameScale
            bird.y += bird.vy * frameScale

            const speed = Math.hypot(bird.vx, bird.vy)
            const settling = flightStartedAt < 0
              ? 1
              : easeInOut(Math.max(0, (flightProgress - 0.88) / 0.12))
            if (speed > 0.12 || settling > 0) {
              const movementAngle = speed > 0.12
                ? uprightAngle(Math.atan2(bird.vy, bird.vx))
                : bird.homeAngle
              const desiredAngle = movementAngle + (bird.homeAngle - movementAngle) * settling
              const angleDelta = Math.atan2(
                Math.sin(desiredAngle - bird.angle),
                Math.cos(desiredAngle - bird.angle),
              )
              bird.angle += angleDelta * Math.min(0.22, 0.11 * frameScale)
            }
            const flap = 0.2 + Math.abs(Math.sin(seconds * (3.2 + agitation * 3.4) + bird.phase)) * 0.92
            drawBird(
              flockContext,
              bird.x,
              bird.y,
              bird.size,
              bird.angle,
              flap,
              bird.gold ? OCHRE : INK,
              bird.gold ? 0.98 : 0.38 + bird.depth * 0.5,
            )
          }
          flockPainted = true
        }

        const mazeIsVisible = scrollWorldY + viewportWorldHeight >= MAZE_CANVAS_TOP
          && scrollWorldY <= MAZE_CANVAS_TOP + MAZE_CANVAS_HEIGHT
        if (mazeIsVisible && mazeStartedAt < 0) mazeStartedAt = now
        if (!mazePainted || mazeIsVisible) {
          const mazeSeconds = mazeStartedAt < 0 ? 0 : (now - mazeStartedAt) / 1000
          mazeContext.setTransform(1, 0, 0, 1, 0, 0)
          mazeContext.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height)
          mazeContext.setTransform(dpr * scale, 0, 0, dpr * scale, 0, -MAZE_CANVAS_TOP * dpr * scale)
          drawMazeRunner(mazeContext, mazeSeconds)
          mazePainted = true
        }
      }

      if (delta >= 0) frame = window.requestAnimationFrame(render)
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('pointermove', updatePointer, { passive: true })
    window.addEventListener('pointerleave', clearPointer, { passive: true })
    window.addEventListener('pointerdown', triggerFlight, { passive: true })
    frame = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', updatePointer)
      window.removeEventListener('pointerleave', clearPointer)
      window.removeEventListener('pointerdown', triggerFlight)
      document.body.classList.remove('fable-flock-clickable')
    }
  }, [motionEnabled])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fable-living-overlay"
        data-motif-count={livingMotifs.length}
        data-world-height={FABLE_WORLD_HEIGHT}
        data-world-width={FABLE_WORLD_WIDTH}
      />
      <canvas
        ref={letterCanvasRef}
        aria-hidden="true"
        className="fable-living-registered"
        data-living-region="letter-person"
        style={{ top: `${LETTER_CANVAS_TOP / FABLE_WORLD_HEIGHT * 100}%` }}
      />
      <canvas
        ref={flockCanvasRef}
        aria-hidden="true"
        className="fable-living-registered"
        data-living-region="murmuration"
        style={{ top: `${FLOCK_CANVAS_TOP / FABLE_WORLD_HEIGHT * 100}%` }}
      />
      <canvas
        ref={mazeCanvasRef}
        aria-hidden="true"
        className="fable-living-registered"
        data-living-region="maze-runner"
        style={{ top: `${MAZE_CANVAS_TOP / FABLE_WORLD_HEIGHT * 100}%` }}
      />
      {prefersReducedMotion && (
        <button
          className="fable-motion-toggle"
          onClick={() => setMotionOverride((current) => !current)}
          type="button"
        >
          {motionEnabled ? 'let the wall rest' : 'wake the wall'}
        </button>
      )}
    </>
  )
}

export default FableLivingCanvas
