import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const url = process.argv[2] ?? 'http://127.0.0.1:4173/fable-alive'
const output = resolve(process.argv[3] ?? 'art-direction/fable-alive/review')
const browser = await chromium.launch()

async function captureJourney(name, viewport, centers) {
  const directory = resolve(output, name)
  await mkdir(directory, { recursive: true })
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle' })
  for (const [index, progress] of centers.entries()) {
    await page.evaluate((value) => {
      const range = document.documentElement.scrollHeight - innerHeight
      window.scrollTo(0, range * value)
    }, progress)
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.fable-wall-tile')).filter((tile) => {
      const rect = tile.getBoundingClientRect()
      return rect.bottom >= 0 && rect.top <= innerHeight
    }).every((tile) => tile.classList.contains('is-loaded')))
    const visible = await page.evaluate(() => Array.from(document.querySelectorAll('.fable-wall-tile')).filter((tile) => {
      const rect = tile.getBoundingClientRect()
      return rect.bottom >= 0 && rect.top <= innerHeight
    }).map((tile) => {
      const image = tile.querySelector('img')
      const rect = tile.getBoundingClientRect()
      return { id: tile.dataset.tileId, top: Math.round(rect.top), bottom: Math.round(rect.bottom), naturalWidth: image?.naturalWidth ?? 0 }
    }))
    process.stdout.write(`${name} ${progress.toFixed(3)} ${JSON.stringify(visible)}\n`)
    await page.screenshot({ path: resolve(directory, `${String(index + 1).padStart(2, '0')}.png`) })
  }
  await page.close()
}

await captureJourney('square', { width: 1080, height: 1080 }, Array.from({ length: 18 }, (_, index) => index / 17))
await captureJourney('desktop', { width: 1440, height: 900 }, [0, .25, .5, .75, 1])
await captureJourney('mobile', { width: 390, height: 844 }, [0, .25, .5, .75, 1])
await browser.close()
