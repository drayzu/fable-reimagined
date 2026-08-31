import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  PROOF_PALETTE, assetDefinitions, assetProofMarks, getLocalProofProgress, getMotifState,
  getProofBeatIndex, interpolateProofProfiles, proofBeats,
  type AssetId, type AssetProofMark, type ProofBeat, type ProofStage, type WorldFrame,
} from './world'
import {
  advanceMaxRevealY, clamp, createSeededRandom, getVisibleWorldRange, lerp, markReveal,
  noise1D, revealCandidateY, smoothstep, worldToViewportY, type WorldTransform,
} from './worldGeometry'

export const WORLD_HEIGHT = 20_000

interface WorldCanvasProps { frameRef: MutableRefObject<WorldFrame>; onUiFrame?: (frame: WorldFrame) => void }
interface Fiber { x: number; y: number; length: number; angle: number; alpha: number }
type AssetImages = Partial<Record<AssetId, HTMLImageElement>>

const fiberRandom = createSeededRandom('unprinted-proof/fibers')
const FIBERS: readonly Fiber[] = Array.from({ length: 560 }, () => ({ x: fiberRandom(), y: fiberRandom(), length: 4 + fiberRandom() * 34, angle: (fiberRandom() - .5) * .7, alpha: .02 + fiberRandom() * .06 }))

function hexToRgb(hex: string): [number, number, number] { const value = Number.parseInt(hex.slice(1), 16); return [(value >> 16) & 255, (value >> 8) & 255, value & 255] }
function mixColor(from: string, to: string, amount: number): string { const a = hexToRgb(from); const b = hexToRgb(to); const t = clamp(amount); return `rgb(${Math.round(lerp(a[0], b[0], t))} ${Math.round(lerp(a[1], b[1], t))} ${Math.round(lerp(a[2], b[2], t))})` }
function worldY(progress: number): number { return progress * WORLD_HEIGHT }
function viewY(progress: number, transform: WorldTransform): number { return worldToViewportY(worldY(progress), transform) }
function revealed(progress: number, maxRevealY: number, feather = 190): number { return markReveal(worldY(progress), maxRevealY, feather) }
function visible(transform: WorldTransform, start: number, end: number, overscan = .016): boolean { const range = getVisibleWorldRange(transform, transform.viewportHeight * .4); return range.end >= worldY(start - overscan) && range.start <= worldY(end + overscan) }
function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed = 0): void { const wobble = noise1D((x1 + y1) * .009, seed) * 2.2; context.beginPath(); context.moveTo(x1, y1); context.quadraticCurveTo((x1 + x2) / 2 + wobble, (y1 + y2) / 2 - wobble, x2, y2); context.stroke() }
function ellipse(context: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rotation = 0): void { context.beginPath(); context.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rotation, 0, Math.PI * 2); context.stroke() }
function ink(night: number, alpha: number): string { return night > .5 ? `rgba(232,225,211,${alpha})` : `rgba(37,36,42,${alpha})` }

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number, progress: number): void {
  const profile = interpolateProofProfiles(progress).visual; const dissolve = getMotifState(progress).dissolution
  context.fillStyle = mixColor(PROOF_PALETTE.bone, PROOF_PALETTE.night, profile.night); context.fillRect(0, 0, width, height)
  const glow = context.createRadialGradient(width * .48, height * .4, 8, width * .48, height * .4, Math.max(width, height) * .82)
  glow.addColorStop(0, profile.night > .5 ? `rgba(72,76,92,${.13 * profile.glow})` : `rgba(255,249,232,${.2 * profile.glow})`); glow.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = glow; context.fillRect(0, 0, width, height)
  if (dissolve > 0) { context.fillStyle = `rgba(3,4,7,${smoothstep(0, 1, dissolve)})`; context.fillRect(0, 0, width, height) }
}

function fieldColor(beat: ProofBeat): string {
  const alpha = .08 + beat.field.pigment * .15
  switch (beat.field.kind) {
    case 'misregister': return `rgba(188,118,94,${alpha})`
    case 'meeting': return `rgba(117,107,135,${alpha})`
    case 'calibration': return `rgba(37,39,49,${alpha * 1.2})`
    case 'scar': return `rgba(22,24,31,${alpha * 1.35})`
    case 'edition': return `rgba(9,11,18,${alpha * 1.5})`
    case 'inspection': return `rgba(12,14,21,${alpha * 1.3})`
    case 'residue': return `rgba(6,8,13,${alpha * 1.5})`
    case 'void': return 'rgba(2,3,6,.68)'
    case 'transfer': return `rgba(82,106,147,${alpha * .58})`
    case 'fold': return `rgba(212,181,106,${alpha * .45})`
    default: return `rgba(255,255,255,${alpha * .22})`
  }
}

function drawFields(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform): void {
  for (const beat of proofBeats) {
    if (!visible(transform, beat.start, beat.end, .025)) continue
    const top = viewY(beat.start - .012, transform); const bottom = viewY(beat.end + .012, transform)
    const gradient = context.createLinearGradient(0, top, 0, bottom); gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(.15, fieldColor(beat)); gradient.addColorStop(.86, fieldColor(beat)); gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient; context.fillRect(0, Math.max(-height, top), width, Math.min(height * 3, bottom - top))
    if (beat.field.kind === 'meeting') { const split = context.createLinearGradient(0, 0, width, 0); split.addColorStop(0, 'rgba(188,118,94,.15)'); split.addColorStop(.5, 'rgba(212,181,106,.035)'); split.addColorStop(1, 'rgba(82,106,147,.16)'); context.fillStyle = split; context.fillRect(0, top, width, bottom - top) }
  }
}

function drawPaper(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, night: number, fast: boolean): void {
  context.save(); context.strokeStyle = ink(night, .065); context.lineWidth = .55
  const count = fast ? 120 : FIBERS.length
  for (let index = 0; index < count; index += 1) { const fiber = FIBERS[index]; const y = (transform.scrollY * .12 + fiber.y * height * 2.1) % (height + 80) - 40; context.globalAlpha = fiber.alpha; line(context, fiber.x * width, y, fiber.x * width + Math.cos(fiber.angle) * fiber.length, y + Math.sin(fiber.angle) * fiber.length, index) }
  context.restore()
}

function clipAssetReveal(context: CanvasRenderingContext2D, mark: AssetProofMark, width: number, height: number, reveal: number): void {
  if (reveal >= .997) return
  const random = createSeededRandom(`proof-mask/${mark.id}`); context.beginPath()
  if (mark.reveal === 'stroke') {
    const bands = 8; const exposed = Math.max(1, Math.ceil(bands * reveal))
    for (let band = 0; band < exposed; band += 1) { const y = height * band / bands; context.rect(-width / 2 - 4, -height / 2 + y - 3 + (random() - .5) * 9, width * (.22 + reveal * .86), height / bands + 9) }
  } else if (mark.reveal === 'dust') {
    const points = Math.ceil(26 + reveal * 120)
    for (let point = 0; point < points; point += 1) { const radius = Math.max(5, width * (.025 + random() * .08) * reveal); context.moveTo((random() - .5) * width + radius, (random() - .5) * height); context.arc((random() - .5) * width, (random() - .5) * height, radius, 0, Math.PI * 2) }
  } else { context.ellipse(0, 0, Math.max(2, width * (.08 + reveal * .54)), Math.max(2, height * (.13 + reveal * .52)), -.17, 0, Math.PI * 2) }
  context.clip()
}

function drawAssetMarks(context: CanvasRenderingContext2D, images: AssetImages, layer: AssetProofMark['layer'], width: number, height: number, transform: WorldTransform, maxRevealY: number, reduced: boolean, progress: number): void {
  const compact = width < 720; const dissolve = getMotifState(progress).dissolution
  for (const mark of assetProofMarks.filter((candidate) => candidate.layer === layer).sort((a, b) => a.order - b.order)) {
    const image = images[mark.assetId]; if (!image?.complete || !image.naturalWidth) continue
    const definition = assetDefinitions[mark.assetId]; const source = definition.crops[mark.cropId]; if (!source) continue
    const placement = compact ? mark.mobile : mark; const drawWidth = width * placement.width; const cropAspect = definition.aspect * source.width / source.height; const drawHeight = drawWidth / cropAspect
    const yProgress = mark.y + (compact ? (mark.mobile.yOffset ?? 0) / 100 : 0); const y = viewY(yProgress, transform)
    if (y + drawHeight < -90 || y > height + 90) continue
    const reveal = reduced ? 1 : revealed(mark.y + mark.order * .00045, maxRevealY, 260); if (reveal <= .002) continue
    const x = width * placement.x; const rotation = ((compact && mark.mobile.rotation !== undefined) ? mark.mobile.rotation : mark.rotation) * Math.PI / 180
    const finalFade = mark.beatId === 'plate-lift' ? 1 - dissolve : 1
    context.save(); context.translate(x + drawWidth / 2, y + drawHeight / 2); context.rotate(rotation); clipAssetReveal(context, mark, drawWidth, drawHeight, reveal)
    context.globalAlpha = mark.opacity * (.2 + reveal * .8) * finalFade; context.globalCompositeOperation = mark.blend === 'normal' ? 'source-over' : mark.blend
    context.drawImage(image, source.x * image.naturalWidth, source.y * image.naturalHeight, source.width * image.naturalWidth, source.height * image.naturalHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight); context.restore()
  }
  context.globalAlpha = 1; context.globalCompositeOperation = 'source-over'
}

function asemicRow(context: CanvasRenderingContext2D, random: () => number, from: number, to: number, y: number, color: string, scale = 1): void {
  context.strokeStyle = color; context.lineWidth = .7 * scale; let x = from
  while (x < to) { const length = (3 + random() * 8) * scale; const rise = (random() - .5) * 7 * scale; context.beginPath(); context.moveTo(x, y); context.quadraticCurveTo(x + length * .45, y - 3 * scale + rise, x + length, y + rise * .25); context.stroke(); x += length + (2 + random() * 5) * scale }
}

function drawPressure(context: CanvasRenderingContext2D, width: number, transform: WorldTransform, maxRevealY: number, now: number, reduced: boolean): void {
  const y = viewY(.023, transform); const alpha = revealed(.004, maxRevealY); const breath = reduced ? 0 : Math.sin(now * .001) * 2
  context.save(); context.globalAlpha = alpha; context.strokeStyle = 'rgba(138,126,108,.18)'; context.lineWidth = .8
  for (let ring = 0; ring < 7; ring += 1) { const inset = 18 + ring * 18 + breath; context.strokeRect(width * .5 - inset, y - inset * .62, inset * 2, inset * 1.24) }
  context.strokeStyle = 'rgba(188,118,94,.35)'; line(context, width * .5 - 25, y, width * .5 + 25, y, 1); line(context, width * .5, y - 25, width * .5, y + 25, 2); context.restore()
}

function drawType(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number): void {
  const random = createSeededRandom('borrowed-type-field'); context.save()
  for (let progress = .049; progress <= .132; progress += .0028) { const y = viewY(progress, transform); if (y < -30 || y > height + 30) continue; const local = Math.abs((progress - .092) / .043); const gap = local < 1 ? width * (.07 + (1 - local) * .15) : 0; const center = width * (.47 + Math.sin(progress * 110) * .02); const alpha = revealed(progress, maxRevealY) * (.13 + random() * .18); asemicRow(context, random, 8, gap ? center - gap : width - 8, y, `rgba(37,36,42,${alpha})`, .74); if (gap) asemicRow(context, random, center + gap, width - 8, y, progress % .011 < .003 ? 'rgba(82,106,147,.25)' : `rgba(37,36,42,${alpha})`, .74) }
  context.restore()
}

function drawReverse(context: CanvasRenderingContext2D, width: number, transform: WorldTransform, maxRevealY: number): void {
  context.save(); context.globalAlpha = revealed(.13, maxRevealY); context.strokeStyle = 'rgba(82,106,147,.18)'; context.lineWidth = .75; const top = viewY(.132, transform); const bottom = viewY(.202, transform)
  context.strokeRect(width * .36, top, width * .48, bottom - top); context.setLineDash([4, 11]); line(context, width * .6, top - 30, width * .6, bottom + 30, 4); context.setLineDash([])
  for (let row = 0; row < 16; row += 1) line(context, width * .4, top + row * (bottom - top) / 16, width * (.48 + Math.sin(row) * .04), top + row * (bottom - top) / 16, row)
  context.restore()
}

function drawTransfer(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number, now: number, reduced: boolean): void {
  const random = createSeededRandom('transfer-field'); context.save(); context.strokeStyle = 'rgba(82,106,147,.25)'; context.lineWidth = .7
  for (let index = 0; index < 190; index += 1) { const progress = .195 + random() * .085; const y = viewY(progress, transform); if (y < -50 || y > height + 50) continue; const x = width * (.48 + random() * .5); const tremor = reduced ? 0 : Math.sin(now * .0008 + index) * .7; context.globalAlpha = revealed(progress, maxRevealY) * (.08 + random() * .22); context.beginPath(); context.moveTo(x, y); context.lineTo(x - 2 + tremor, y + 8 + random() * 28); context.stroke() }
  context.globalAlpha = revealed(.255, maxRevealY) * .28; context.strokeStyle = 'rgba(37,36,42,.3)'; for (let row = 0; row < 8; row += 1) line(context, width * .08, viewY(.25 + row * .0022, transform), width * (.42 + row * .035), viewY(.25 + row * .0022, transform), row)
  context.restore()
}

function drawMisregistration(context: CanvasRenderingContext2D, width: number, transform: WorldTransform, maxRevealY: number): void {
  const alpha = revealed(.28, maxRevealY); context.save(); context.globalAlpha = alpha; const y = viewY(.342, transform)
  for (let item = 0; item < 12; item += 1) { const x = width * (.05 + item * .075); const drift = Math.max(0, item - 5) * 2.4; context.fillStyle = 'rgba(188,118,94,.25)'; context.fillRect(x - drift, y + Math.sin(item) * 9, 24, 24); context.fillStyle = 'rgba(82,106,147,.25)'; context.fillRect(x + drift, y + Math.sin(item) * 9 + drift * .3, 24, 24) }
  context.restore()
}

function drawCurrent(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number): void {
  const random = createSeededRandom('many-proofs-current'); context.save(); context.globalAlpha = revealed(.36, maxRevealY)
  for (let index = 0; index < 520; index += 1) { const t = random(); const progress = .36 + t * .07 + (random() - .5) * .018; const y = viewY(progress, transform); if (y < -30 || y > height + 30) continue; const x = width * (.02 + t * .96 + (random() - .5) * .18); const length = 2 + random() * 10; context.strokeStyle = index % 11 === 0 ? 'rgba(188,118,94,.45)' : index % 17 === 0 ? 'rgba(82,106,147,.42)' : 'rgba(37,36,42,.26)'; context.lineWidth = .65; line(context, x, y, x + length, y - length * .25, index) }
  context.restore()
}

function drawPractice(context: CanvasRenderingContext2D, width: number, transform: WorldTransform, maxRevealY: number): void {
  context.save(); context.globalAlpha = revealed(.43, maxRevealY); context.strokeStyle = 'rgba(37,36,42,.2)'; context.lineWidth = .7; const top = viewY(.435, transform); const bottom = viewY(.5, transform); const panels = 9
  context.beginPath(); context.moveTo(width * .04, top)
  for (let panel = 0; panel <= panels; panel += 1) { const x = width * (.04 + panel * .102); const y = top + (panel % 2 ? 28 : 0); context.lineTo(x, y); context.lineTo(x, bottom - (panel % 2 ? 20 : 0)); if (panel < panels) { const cx = x + width * .05; context.strokeStyle = panel > 6 ? 'rgba(188,118,94,.35)' : 'rgba(82,106,147,.23)'; ellipse(context, cx + Math.max(0, panel - 5) * 7, (top + bottom) / 2, 6 + panel * 2.6, 5 + panel * 1.4, panel * .07) } }
  context.strokeStyle = 'rgba(37,36,42,.2)'; context.stroke(); context.restore()
}

function drawMeeting(context: CanvasRenderingContext2D, width: number, transform: WorldTransform, maxRevealY: number): void {
  context.save(); context.globalAlpha = revealed(.5, maxRevealY); const centerY = viewY(.55, transform)
  for (let row = -11; row <= 11; row += 1) { context.strokeStyle = 'rgba(188,118,94,.24)'; line(context, 0, centerY + row * 25, width * .49, centerY + row * 17, row); context.strokeStyle = 'rgba(82,106,147,.26)'; line(context, width, centerY + row * 25, width * .51, centerY + row * 17, row + 40) }
  context.strokeStyle = 'rgba(212,181,106,.48)'; context.lineWidth = 1; for (let route = 0; route < 7; route += 1) { context.beginPath(); context.moveTo(width * .46, centerY - 70 + route * 22); context.bezierCurveTo(width * (.49 + route * .002), centerY - 30, width * (.51 - route * .002), centerY + 35, width * .54, centerY + 65 - route * 17); context.stroke() }
  context.restore()
}

function drawCertainty(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number): void {
  context.save(); context.globalAlpha = revealed(.59, maxRevealY); context.strokeStyle = 'rgba(232,225,211,.22)'; context.lineWidth = .65; const startX = width * .4; const startY = viewY(.595, transform); const cell = Math.min(78, width * .09)
  for (let row = 0; row < 8; row += 1) for (let column = 0; column < 7; column += 1) { const x = startX + column * cell; const y = startY + row * 54; if (y < -60 || y > height + 60) continue; const wrong = row === 5 && column === 4; context.strokeStyle = wrong ? 'rgba(212,181,106,.7)' : 'rgba(232,225,211,.2)'; context.strokeRect(x, y, cell - 8, 42); line(context, x + 8, y + 21, x + cell - 16, y + 21, row + column) }
  context.strokeStyle = 'rgba(212,181,106,.5)'; context.setLineDash([2, 10]); context.beginPath(); context.moveTo(width * .67, viewY(.59, transform)); context.bezierCurveTo(width * .8, viewY(.61, transform), width * .72, viewY(.65, transform), width * .49, viewY(.67, transform)); context.stroke(); context.restore()
}

function drawScrape(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number): void {
  const random = createSeededRandom('scraped-plate'); context.save(); context.globalAlpha = revealed(.67, maxRevealY); const center = viewY(.704, transform)
  context.strokeStyle = 'rgba(232,225,211,.34)'; context.lineWidth = 1.2; for (let cut = 0; cut < 19; cut += 1) line(context, -30, center - 65 + cut * 8, width * (.62 + random() * .35), center - 110 + cut * 12 + random() * 16, cut)
  context.fillStyle = 'rgba(188,118,94,.38)'; for (let point = 0; point < 220; point += 1) { const x = width * (.48 + random() * .48); const y = center - 120 + random() * 270; context.beginPath(); context.arc(x, y, .4 + random() * 1.8, 0, Math.PI * 2); context.fill() }
  context.restore()
}

function drawEdition(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number, now: number, reduced: boolean): void {
  const random = createSeededRandom('unprinted-edition'); context.save(); context.globalAlpha = revealed(.74, maxRevealY)
  for (let plate = 0; plate < 13; plate += 1) { const progress = .742 + plate * .0066; const y = viewY(progress, transform); if (y < -160 || y > height + 160) continue; const drift = reduced ? 0 : Math.sin(now * .00025 + plate) * 7; const x = width * (.05 + (plate % 5) * .19) + drift; const w = width * (.2 + (plate % 3) * .04); const h = 95 + (plate % 4) * 28; context.strokeStyle = plate % 2 ? 'rgba(82,106,147,.2)' : 'rgba(232,225,211,.17)'; context.setLineDash(plate % 3 === 0 ? [3, 9] : []); context.strokeRect(x, y, w, h); context.setLineDash([]); for (let route = 0; route < 4; route += 1) line(context, x + 13, y + 18 + route * 17, x + w * (.45 + random() * .45), y + 18 + route * 17 + (random() - .5) * 9, route + plate) }
  context.restore()
}

function drawInspection(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number, now: number, reduced: boolean): void {
  context.save(); context.globalAlpha = revealed(.83, maxRevealY); const x = width * .68; const y = viewY(.868, transform); const pulse = reduced ? 0 : Math.sin(now * .001) * 4
  const glow = context.createRadialGradient(x, y, 5, x, y, Math.min(width * .25, 250 + pulse)); glow.addColorStop(0, 'rgba(212,181,106,.32)'); glow.addColorStop(.28, 'rgba(212,181,106,.12)'); glow.addColorStop(1, 'rgba(212,181,106,0)'); context.fillStyle = glow; context.fillRect(x - 300, y - 300, 600, 600)
  context.strokeStyle = 'rgba(232,225,211,.24)'; context.lineWidth = .75; for (let route = 0; route < 12; route += 1) { context.beginPath(); context.moveTo(width * .08, y + (route - 6) * 30); context.bezierCurveTo(width * .34, y + Math.sin(route) * 90, width * .48, y + Math.cos(route * 2) * 80, x + (route - 6) * 9, y + (route - 6) * 7); context.stroke() }
  context.restore()
}

function drawContact(context: CanvasRenderingContext2D, width: number, transform: WorldTransform, maxRevealY: number): void {
  context.save(); context.globalAlpha = revealed(.9, maxRevealY); const y = viewY(.927, transform); const sizes = [95, 55]
  sizes.forEach((size, index) => { const x = width * (.46 + index * .07); context.strokeStyle = index ? 'rgba(82,106,147,.46)' : 'rgba(188,118,94,.46)'; context.lineWidth = .9; line(context, x - size, y, x + size, y, index); line(context, x, y - size, x, y + size, index + 2) })
  context.strokeStyle = 'rgba(232,225,211,.12)'; for (let row = -5; row <= 5; row += 1) line(context, width * .08, y + row * 33, width * .92, y + row * 33 + Math.sin(row) * 5, row)
  context.restore()
}

function drawLift(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number, progress: number): void {
  const local = clamp((progress - .95) / .05); const dissolve = getMotifState(progress).dissolution; context.save(); context.globalAlpha = revealed(.95, maxRevealY) * (1 - dissolve)
  const centerY = viewY(.968, transform); const colors = ['rgba(188,118,94,.36)', 'rgba(82,106,147,.38)', 'rgba(212,181,106,.32)', 'rgba(232,225,211,.2)']
  for (let channel = 0; channel < 12; channel += 1) { const x = width * (.28 + channel * .04); const lift = Math.max(0, local - .55) * height * (1 + channel * .04); context.strokeStyle = colors[channel % colors.length]; context.lineWidth = 1; context.beginPath(); context.moveTo(x, centerY + 180); context.bezierCurveTo(x + Math.sin(channel) * 60, centerY + 70, x + Math.cos(channel) * 70, centerY - 90 - lift, x + (channel - 6) * 5, centerY - 240 - lift); context.stroke() }
  context.restore()
}

function drawStage(context: CanvasRenderingContext2D, stage: ProofStage, width: number, height: number, transform: WorldTransform, maxRevealY: number, now: number, reduced: boolean, progress: number): void {
  switch (stage) {
    case 'pressure': drawPressure(context, width, transform, maxRevealY, now, reduced); break
    case 'type': drawType(context, width, height, transform, maxRevealY); break
    case 'reverse': drawReverse(context, width, transform, maxRevealY); break
    case 'transfer': drawTransfer(context, width, height, transform, maxRevealY, now, reduced); break
    case 'misregister': drawMisregistration(context, width, transform, maxRevealY); break
    case 'current': drawCurrent(context, width, height, transform, maxRevealY); break
    case 'practice': drawPractice(context, width, transform, maxRevealY); break
    case 'meeting': drawMeeting(context, width, transform, maxRevealY); break
    case 'certainty': drawCertainty(context, width, height, transform, maxRevealY); break
    case 'scrape': drawScrape(context, width, height, transform, maxRevealY); break
    case 'edition': drawEdition(context, width, height, transform, maxRevealY, now, reduced); break
    case 'inspection': drawInspection(context, width, height, transform, maxRevealY, now, reduced); break
    case 'contact': drawContact(context, width, transform, maxRevealY); break
    case 'lift': drawLift(context, width, height, transform, maxRevealY, progress); break
  }
}

function drawMicroStudies(context: CanvasRenderingContext2D, width: number, height: number, transform: WorldTransform, maxRevealY: number, night: number): void {
  for (const beat of proofBeats) {
    if (!visible(transform, beat.start, beat.end)) continue
    const random = createSeededRandom(`micro/${beat.id}`); context.save(); context.lineWidth = .62
    for (let index = 0; index < beat.microStudyCount; index += 1) { const progress = beat.start + (beat.end - beat.start) * (.08 + random() * .84); const y = viewY(progress, transform); if (y < -50 || y > height + 50) continue; const x = width * (.03 + random() * .94); const scale = .55 + random() * .9; context.globalAlpha = revealed(progress, maxRevealY) * (.18 + random() * .2); context.strokeStyle = index % 5 === 0 ? 'rgba(188,118,94,.5)' : index % 7 === 0 ? 'rgba(82,106,147,.48)' : ink(night, .5); if (index % 4 === 0) { line(context, x - 10 * scale, y, x + 10 * scale, y, index); line(context, x, y - 10 * scale, x, y + 10 * scale, index + 1) } else if (index % 4 === 1) { context.strokeRect(x - 8 * scale, y - 6 * scale, 16 * scale, 12 * scale) } else if (index % 4 === 2) { context.setLineDash([2, 6]); line(context, x - 17 * scale, y + 7, x + 17 * scale, y - 7, index); context.setLineDash([]) } else ellipse(context, x, y, 4 * scale, 2 * scale, random()) }
    context.restore()
  }
}

function drawInspectionOverlay(context: CanvasRenderingContext2D, width: number, height: number, pointerX: number, pointerY: number, pointerActive: boolean, progress: number): void {
  if (!pointerActive || progress >= .995) return
  context.save(); const radius = width < 720 ? 150 : 205; const gradient = context.createRadialGradient(pointerX * width, pointerY * height, 3, pointerX * width, pointerY * height, radius); gradient.addColorStop(0, 'rgba(255,248,219,.13)'); gradient.addColorStop(.55, 'rgba(212,181,106,.055)'); gradient.addColorStop(1, 'rgba(212,181,106,0)'); context.fillStyle = gradient; context.fillRect(0, 0, width, height)
  const random = createSeededRandom(`inspection/${Math.floor(progress * 14)}`); context.strokeStyle = progress > .59 ? 'rgba(232,225,211,.2)' : 'rgba(37,36,42,.2)'; context.lineWidth = .65
  for (let index = 0; index < 18; index += 1) { const angle = random() * Math.PI * 2; const distance = random() * radius * .72; const x = pointerX * width + Math.cos(angle) * distance; const y = pointerY * height + Math.sin(angle) * distance; line(context, x - 12, y, x + 12 + random() * 25, y + (random() - .5) * 8, index) }
  context.restore()
}

function drawUnderWorld(context: CanvasRenderingContext2D, images: AssetImages, width: number, height: number, transform: WorldTransform, maxRevealY: number, now: number, reduced: boolean, progress: number, velocity: number): void {
  const profile = interpolateProofProfiles(progress).visual; drawBackdrop(context, width, height, progress); drawFields(context, width, height, transform); drawPaper(context, width, height, transform, profile.night, velocity > .65)
  for (const beat of proofBeats) if (visible(transform, beat.start, beat.end, .02)) drawStage(context, beat.stage, width, height, transform, maxRevealY, now, reduced, progress)
  drawAssetMarks(context, images, 'under', width, height, transform, maxRevealY, reduced, progress); drawMicroStudies(context, width, height, transform, maxRevealY, profile.night)
  const dissolution = getMotifState(progress).dissolution
  if (dissolution > 0) { context.fillStyle = `rgba(0,0,0,${smoothstep(0, 1, dissolution)})`; context.fillRect(0, 0, width, height) }
}

function drawOverWorld(context: CanvasRenderingContext2D, images: AssetImages, width: number, height: number, transform: WorldTransform, maxRevealY: number, reduced: boolean, progress: number, pointerX: number, pointerY: number, pointerActive: boolean): void {
  context.clearRect(0, 0, width, height); drawAssetMarks(context, images, 'over', width, height, transform, maxRevealY, reduced, progress); drawInspectionOverlay(context, width, height, pointerX, pointerY, pointerActive, progress)
}

export function WorldCanvas({ frameRef, onUiFrame }: WorldCanvasProps) {
  const underRef = useRef<HTMLCanvasElement>(null); const overRef = useRef<HTMLCanvasElement>(null); const imagesRef = useRef<AssetImages>({}); const onUiFrameRef = useRef(onUiFrame)

  useEffect(() => { onUiFrameRef.current = onUiFrame }, [onUiFrame])

  useEffect(() => {
    const under = underRef.current; const over = overRef.current; if (!under || !over) return
    const underContext = under.getContext('2d', { alpha: false }); const overContext = over.getContext('2d', { alpha: true }); if (!underContext || !overContext) return
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)'); const finePointerQuery = window.matchMedia('(pointer: fine)'); const root = document.documentElement
    let pointerX = .5; let pointerY = .55; let pointerActive = false; let pointerLastMoved = 0; let previousTime = performance.now(); let previousScrollY = window.scrollY; let filteredVelocity = 0; let maxRevealY = 0; let lastUiKey = ''; let lastDrawnScroll = -1; let animationFrame = 0

    const loadAround = (index: number) => {
      const wanted = new Set<AssetId>(); for (let offset = -1; offset <= 1; offset += 1) { const beat = proofBeats[index + offset]; beat?.marks.forEach((mark) => wanted.add(mark.assetId)) }
      wanted.forEach((assetId) => { if (imagesRef.current[assetId]) return; const image = new Image(); image.decoding = 'async'; image.src = assetDefinitions[assetId].source; image.onload = () => { lastDrawnScroll = -1 }; imagesRef.current[assetId] = image })
    }
    const resize = () => { const width = window.innerWidth; const height = window.innerHeight; const compact = width < 720; const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 2); for (const canvas of [under, over]) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); canvas.style.width = `${width}px`; canvas.style.height = `${height}px` } underContext.setTransform(dpr, 0, 0, dpr, 0, 0); overContext.setTransform(dpr, 0, 0, dpr, 0, 0); lastDrawnScroll = -1 }
    const move = (event: PointerEvent) => { if (!finePointerQuery.matches) return; pointerX = clamp(event.clientX / Math.max(1, window.innerWidth)); pointerY = clamp(event.clientY / Math.max(1, window.innerHeight)); pointerActive = true; pointerLastMoved = performance.now() }
    const leave = () => { pointerActive = false }
    resize(); window.addEventListener('resize', resize); window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('pointerleave', leave)

    const tick = (now: number) => {
      const width = window.innerWidth; const height = window.innerHeight; const reduced = reducedQuery.matches; const scrollable = Math.max(1, document.documentElement.scrollHeight - height); const scrollY = clamp(window.scrollY, 0, scrollable); const deltaTime = Math.max(8, Math.min(64, now - previousTime)); const scrollDelta = scrollY - previousScrollY; const instantVelocity = Math.abs(scrollDelta) / deltaTime
      filteredVelocity = lerp(filteredVelocity, clamp(instantVelocity / 2.2), .12); const direction: -1 | 0 | 1 = Math.abs(scrollDelta) < .1 ? 0 : scrollDelta > 0 ? 1 : -1; previousScrollY = scrollY; previousTime = now
      const transform: WorldTransform = { worldHeight: WORLD_HEIGHT, documentHeight: scrollable, viewportHeight: height, scrollY }; maxRevealY = reduced ? WORLD_HEIGHT : advanceMaxRevealY(maxRevealY, revealCandidateY(transform, .88), WORLD_HEIGHT)
      const progress = clamp(scrollY / scrollable); const movementIndex = getProofBeatIndex(progress); const beat = proofBeats[movementIndex]; const range = getVisibleWorldRange(transform); const coarse = !finePointerQuery.matches
      if (coarse) { pointerX = .28 + Math.sin(progress * 15) * .18; pointerY = .5; pointerActive = !reduced } else if (pointerActive && now - pointerLastMoved > 3800) pointerActive = false
      loadAround(movementIndex); const profile = interpolateProofProfiles(progress); const dissolveProgress = getMotifState(progress).dissolution
      const pointer = { x: pointerX, y: pointerY, active: pointerActive, coarse, trail: [] }; const frame: WorldFrame = { progress, previousProgress: frameRef.current.progress, localProgress: getLocalProofProgress(progress, beat), movementIndex, scrollY, worldHeight: WORLD_HEIGHT, viewportWidth: width, viewportHeight: height, visibleTop: range.start, visibleBottom: range.end, maxRevealY, velocity: filteredVelocity, timeMs: now, scrollDirection: direction, dissolveProgress, pointer, reducedMotion: reduced, profile }; frameRef.current = frame
      root.style.setProperty('--probe-x', `${pointerX * width}px`); root.style.setProperty('--probe-y', `${scrollY + pointerY * height}px`); root.style.setProperty('--probe-screen-y', `${pointerY * height}px`); root.style.setProperty('--probe-opacity', pointerActive ? '1' : '0'); root.style.setProperty('--proof-progress', progress.toFixed(5)); root.style.setProperty('--dissolve', dissolveProgress.toFixed(4)); root.style.setProperty('--reveal-bottom', `${(100 - maxRevealY / WORLD_HEIGHT * 100).toFixed(3)}%`)
      const uiKey = `${movementIndex}/${profile.visual.night > .5}/${progress > .045}/${dissolveProgress.toFixed(2)}`; if (uiKey !== lastUiKey) { lastUiKey = uiKey; onUiFrameRef.current?.(frame) }
      const restlessChanged = !reduced && Math.floor(now / 3600) !== Math.floor((now - deltaTime) / 3600); if (!reduced || lastDrawnScroll !== scrollY || restlessChanged || pointerActive) { drawUnderWorld(underContext, imagesRef.current, width, height, transform, maxRevealY, now, reduced, progress, filteredVelocity); drawOverWorld(overContext, imagesRef.current, width, height, transform, maxRevealY, reduced, progress, pointerX, pointerY, pointerActive); lastDrawnScroll = scrollY }
      animationFrame = window.requestAnimationFrame(tick)
    }
    animationFrame = window.requestAnimationFrame(tick)
    return () => { window.cancelAnimationFrame(animationFrame); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave) }
  }, [frameRef])

  return <><canvas ref={underRef} className="world-canvas world-canvas-under" aria-hidden="true" /><canvas ref={overRef} className="world-canvas world-canvas-over" aria-hidden="true" /></>
}
