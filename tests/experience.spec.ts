import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const checkpoints = [0, 0.15, 0.35, 0.5, 0.7, 0.88, 1]
const movements = [0.03, 0.105, 0.19, 0.285, 0.39, 0.485, 0.58, 0.665, 0.745, 0.835, 0.91, 0.975]

async function goToProgress(page: Page, progress: number) {
  await page.evaluate((value) => {
    const distance = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, distance * value)
  }, progress)
  await page.waitForTimeout(180)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.fonts.status === 'loaded')
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>('img[loading="eager"]'))
      .every((image) => image.complete && image.naturalWidth > 0),
  )
})

test('renders the complete semantic journey without layout or console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await expect(page.locator('#transcript section')).toHaveCount(12)
  await expect(page.getByRole('heading', { name: 'The Interval', exact: true })).toBeAttached()
  await expect(page.locator('canvas.world-canvas')).toBeVisible()
  const worldHeight = await page.locator('.world-wall').evaluate((element) => element.getBoundingClientRect().height)
  const viewportHeight = await page.evaluate(() => window.innerHeight)
  expect(Math.abs(worldHeight - viewportHeight * 21)).toBeLessThanOrEqual(2)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)

  for (const checkpoint of checkpoints) {
    await goToProgress(page, checkpoint)
    const state = await page.evaluate(() => ({
      top: window.scrollY,
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    }))
    expect(state.top).toBeGreaterThanOrEqual(0)
    expect(state.top).toBeLessThanOrEqual(state.height - state.viewport + 1)
  }

  expect(errors).toEqual([])
})

test('captures all twelve visual movements', async ({ page }, testInfo) => {
  const directory = path.join(testInfo.outputDir, 'journey')
  fs.mkdirSync(directory, { recursive: true })
  for (const checkpoint of movements) {
    await goToProgress(page, checkpoint)
    const name = `${String(Math.round(checkpoint * 100)).padStart(3, '0')}.png`
    await page.screenshot({ path: path.join(directory, name), animations: 'disabled' })
  }
})

test('sound remains opt-in and can be toggled from the keyboard', async ({ page }) => {
  await goToProgress(page, 0.12)
  const sound = page.getByRole('button', { name: 'Turn sound on' })
  await expect(sound).toBeVisible()
  await sound.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Turn sound off' })).toHaveAttribute('aria-pressed', 'true')
})

test('reduced motion keeps the journey readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await goToProgress(page, 0.5)
  await expect(page.locator('canvas.world-canvas')).toBeVisible()
  const animatedBars = await page.locator('.sound-glyph i').evaluateAll((elements) =>
    elements.every((element) => {
      const style = getComputedStyle(element)
      return style.animationName === 'none' || Number.parseFloat(style.animationDuration) <= 0.001
    }),
  )
  expect(animatedBars).toBe(true)
})

test('plate imagery is integrated through non-rectangular masks', async ({ page }) => {
  const fragments = page.locator('.world-fragment')
  await expect(fragments).toHaveCount(10)
  const masks = await fragments.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element)
    return { clip: style.clipPath, mask: style.maskImage }
  }))
  expect(masks.every(({ clip, mask }) => clip !== 'none' || mask !== 'none')).toBe(true)
})

test('the complete manuscript remains semantic and resize-safe', async ({ page }) => {
  await expect(page.getByRole('article', { name: 'The Interval transcript' })).toBeAttached()
  await expect(page.locator('#transcript').getByText('between them, something neither of us brought alone.')).toBeAttached()
  await goToProgress(page, 0.91)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(120)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.locator('canvas.world-canvas')).toBeVisible()
})
