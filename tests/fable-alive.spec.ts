import { expect, test, type Page } from '@playwright/test'

async function scrollToProgress(page: Page, progress: number) {
  await page.evaluate((value) => {
    const range = document.documentElement.scrollHeight - innerHeight
    window.scrollTo(0, range * value)
  }, progress)
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.fable-wall-tile')).filter((tile) => {
    const rect = tile.getBoundingClientRect()
    return rect.bottom >= 0 && rect.top <= innerHeight
  }).every((tile) => tile.classList.contains('is-loaded')))
}

test('keeps The Unprinted Proof isolated on the root route', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'The Unprinted Proof', exact: true })).toBeAttached()
  await expect(page.locator('.world-wall')).toHaveCount(1)
  await expect(page.locator('.fable-wall')).toHaveCount(0)
})

test('reconstructs the complete living Fable wall without seams or overflow', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/fable-alive')
  await expect(page.getByRole('heading', { name: 'Fable Alive — living study', exact: true })).toBeAttached()
  await expect(page.locator('.fable-wall-tile')).toHaveCount(18)
  await expect(page.locator('.fable-living-overlay')).toHaveAttribute('data-motif-count', '5')
  const geometry = await page.locator('.fable-wall-tile').evaluateAll((tiles) => tiles.map((tile) => {
    const rect = tile.getBoundingClientRect()
    return { top: rect.top + scrollY, bottom: rect.bottom + scrollY }
  }))
  geometry.slice(1).forEach((tile, index) => expect(Math.abs(tile.top - geometry[index].bottom)).toBeLessThan(.08))
  const wall = await page.locator('.fable-wall').evaluate((element) => element.getBoundingClientRect())
  expect(wall.height / wall.width).toBeCloseTo(12.8, 3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})

test('loads every tile while preserving native scroll and opt-in-free decorative motion', async ({ page }) => {
  await page.goto('/fable-alive')
  for (const progress of [0, .2, .4, .6, .8, 1]) await scrollToProgress(page, progress)
  await page.waitForFunction(() => document.querySelectorAll('.fable-wall-tile.is-loaded').length === 18)
  const sources = await page.locator('.fable-wall-tile img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).currentSrc))
  expect(new Set(sources).size).toBe(18)
  expect(sources.every((source) => source.endsWith('.webp'))).toBe(true)
  await expect(page.locator('audio, .sound-control, #trail')).toHaveCount(0)
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto')
})
