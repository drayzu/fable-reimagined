import { expect, test, type Page } from '@playwright/test'

test.use({ video: 'on' })

async function traverse(page: Page, direction: 'forward' | 'backward') {
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  const frames = 180
  for (let frame = 0; frame <= frames; frame += 1) {
    const ratio = frame / frames; const progress = direction === 'forward' ? ratio : 1 - ratio
    await page.evaluate(({ y }) => window.scrollTo(0, y), { y: scrollHeight * progress }); await page.waitForTimeout(20)
  }
}

test('records a continuous forward traversal', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => document.fonts.status === 'loaded'); await traverse(page, 'forward')
  await expect(page.locator('main')).toHaveAttribute('data-movement', 'a-temporary-grammar')
})

test('records a continuous backward traversal', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => document.fonts.status === 'loaded'); await traverse(page, 'backward')
  await expect(page.locator('main')).toHaveAttribute('data-movement', 'before-the-question')
})
