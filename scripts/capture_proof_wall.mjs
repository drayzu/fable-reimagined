import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const url = process.argv[2] ?? 'http://127.0.0.1:4173/'
const outputRoot = resolve(process.argv[3] ?? 'art-direction/unprinted-proof/review')
const centers = [.025, .09, .165, .24, .32, .395, .465, .545, .63, .705, .785, .865, .925, .975]
const sizes = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const browser = await chromium.launch()
for (const size of sizes) {
  const directory = resolve(outputRoot, size.name)
  await mkdir(directory, { recursive: true })
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [index, center] of centers.entries()) {
    await page.evaluate((progress) => {
      const range = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, range * progress)
    }, center)
    await page.waitForTimeout(120)
    await page.screenshot({ path: resolve(directory, `${String(index + 1).padStart(2, '0')}.png`) })
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(120)
  await page.screenshot({ path: resolve(directory, 'final-black.png') })
  await page.close()
}
await browser.close()
