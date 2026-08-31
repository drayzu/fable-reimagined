import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const SOURCE_URL = 'https://www.kengoworks.com/fable?fast'
const OUTPUT = resolve(process.argv[2] ?? 'art-direction/fable-alive/source')
const WORLD_WIDTH = 1600
const TILE_HEIGHT = 1200

await mkdir(OUTPUT, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: WORLD_WIDTH, height: TILE_HEIGHT },
  deviceScaleFactor: 1.35,
  reducedMotion: 'reduce',
})
const page = await context.newPage()
await page.goto(SOURCE_URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => document.querySelectorAll('#wall canvas').length === 18)

const tileCount = await page.locator('#wall canvas').count()
for (let index = 0; index < tileCount; index += 1) {
  await page.evaluate((tileIndex) => {
    const canvas = document.querySelectorAll('#wall canvas')[tileIndex]
    window.scrollTo(0, Math.min(canvas.offsetTop, document.documentElement.scrollHeight - innerHeight))
  }, index)
  await page.waitForFunction((tileIndex) => {
    return typeof GENDONE !== 'undefined' && GENDONE === true && TILES?.[tileIndex]?.done === true
  }, index)
}

const manifest = []
for (let index = 0; index < tileCount; index += 1) {
  const dataUrl = await page.locator('#wall canvas').nth(index).evaluate((canvas) => canvas.toDataURL('image/png'))
  const buffer = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  const filename = `tile-${String(index).padStart(2, '0')}.png`
  await writeFile(resolve(OUTPUT, filename), buffer)
  const dimensions = await page.locator('#wall canvas').nth(index).evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    logicalTop: Number.parseFloat(canvas.style.top) / 100 * 1600,
    logicalHeight: Number.parseFloat(canvas.style.height) / 100 * 1600,
  }))
  manifest.push({ index, filename, ...dimensions })
}

await writeFile(resolve(OUTPUT, 'capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await browser.close()

for (const tile of manifest) {
  process.stdout.write(`${tile.filename}: ${tile.width}×${tile.height}, world ${tile.logicalTop}–${tile.logicalTop + tile.logicalHeight}\n`)
}
