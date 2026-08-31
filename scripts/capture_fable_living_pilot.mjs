import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve('art-direction/fable-alive/living-review')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
  page.on('pageerror', (error) => process.stderr.write(`${viewport.name} pageerror: ${error.message}\n`))
  page.on('console', (message) => {
    if (message.type() === 'error') process.stderr.write(`${viewport.name} console: ${message.text()}\n`)
  })
  await page.goto('http://127.0.0.1:4173/fable-alive', { waitUntil: 'networkidle' })
  for (const scene of [
    { name: 'letters-a', y: 3050 },
    { name: 'letters-b', y: 3050 },
    { name: 'rain', y: 4150 },
    { name: 'birds-a', y: 5360 },
    { name: 'birds-b', y: 5360 },
  ]) {
    await page.evaluate(({ worldY, worldWidth }) => {
      const scale = innerWidth / worldWidth
      window.scrollTo(0, worldY * scale - innerHeight / 2)
    }, { worldY: scene.y, worldWidth: 1600 })
    if (scene.name === 'birds-b') {
      await page.mouse.click(viewport.width * 0.52, viewport.height * 0.54)
    }
    await page.waitForTimeout(scene.name === 'birds-b' ? 8500 : scene.name === 'letters-b' ? 900 : 350)
    await page.screenshot({ path: resolve(output, `${viewport.name}-${scene.name}.png`) })
  }
  await page.close()
}

await browser.close()
