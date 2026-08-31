import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(process.argv[2] ?? 'http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.evaluate(() => {
  const range = document.documentElement.scrollHeight - innerHeight
  scrollTo(0, range * .865)
  const control = document.querySelector('.sound-control')
  if (control instanceof HTMLElement) control.style.display = 'none'
})
await page.waitForTimeout(180)
await page.screenshot({ path: process.argv[3] ?? 'art-direction/unprinted-proof/social-source.png' })
await browser.close()
