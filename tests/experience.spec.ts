import { expect, test, type Page } from '@playwright/test'

const checkpoints = [0, .09, .165, .24, .32, .395, .465, .545, .63, .705, .785, .865, .925, .984, 1]

async function goToProgress(page: Page, progress: number) {
  await page.evaluate((value) => {
    const distance = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, distance * value)
  }, progress)
  await page.waitForTimeout(160)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.fonts.status === 'loaded')
})

test('renders the complete semantic journey without overflow or console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.locator('#transcript section')).toHaveCount(14)
  await expect(page.getByRole('heading', { name: 'The Unprinted Proof', exact: true })).toBeAttached()
  await expect(page.locator('canvas.world-canvas')).toHaveCount(2)
  const worldHeight = await page.locator('.world-wall').evaluate((element) => element.getBoundingClientRect().height)
  const viewportHeight = await page.evaluate(() => innerHeight)
  expect(Math.abs(worldHeight - viewportHeight * 21)).toBeLessThanOrEqual(2)
  for (const checkpoint of checkpoints) {
    await goToProgress(page, checkpoint)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  }
  expect(errors).toEqual([])
})

test('aligns, dissolves, and reversibly restores the final proof', async ({ page }) => {
  const title = page.locator('.world-copy.is-title')
  await expect(title).toHaveCount(1); await expect(title).not.toBeInViewport()
  await goToProgress(page, .984)
  await expect(title).toBeInViewport(); await expect(title.getByText('the unprinted proof', { exact: true })).toBeVisible()
  await goToProgress(page, 1)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dissolve').trim())).toBe('1.0000')
  await goToProgress(page, .984)
  await expect(title.getByText('the unprinted proof', { exact: true })).toBeVisible()
})

test('inspection stays local and sound remains opt-in', async ({ page }) => {
  await goToProgress(page, .32)
  const artwork = page.locator('.world-canvas-over'); const before = await artwork.boundingBox()
  await page.mouse.move(430, 430); await page.waitForTimeout(100)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--probe-opacity').trim())).toBe('1')
  expect(await artwork.boundingBox()).toEqual(before)
  const sound = page.getByRole('button', { name: 'Turn sound on' })
  await expect(sound).toHaveAttribute('aria-pressed', 'false'); await sound.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Turn sound off' })).toHaveAttribute('aria-pressed', 'true')
})

test('reduced motion presents a complete static proof', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await goToProgress(page, .55)
  await expect(page.locator('canvas.world-canvas').first()).toBeVisible()
  const state = await page.evaluate(() => ({
    possibilityOpacity: getComputedStyle(document.querySelector('.possibility-field')!).opacity,
    bars: Array.from(document.querySelectorAll('.sound-glyph i')).every((element) => getComputedStyle(element).animationName === 'none'),
    ring: getComputedStyle(document.querySelector('.inspection-ring')!).display,
  }))
  expect(Number.parseFloat(state.possibilityOpacity)).toBeGreaterThan(.3)
  expect(state.bars).toBe(true); expect(state.ring).toBe('none')
})

test('composites the nine proof sources in canvas without image chrome', async ({ page }) => {
  for (const progress of checkpoints.slice(1, -1)) await goToProgress(page, progress)
  const sources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('/art/proof/')))
  expect(new Set(sources).size).toBe(9)
  expect(sources.every((source) => source.endsWith('.webp'))).toBe(true)
  expect(await page.locator('img, .atlas-fragment').count()).toBe(0)
  await expect(page.getByRole('article', { name: 'The Unprinted Proof transcript' })).toContainText('the print belongs to neither.')
})
