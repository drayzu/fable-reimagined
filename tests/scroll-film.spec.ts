import { expect, test } from '@playwright/test'

test.use({ video: 'on' })

test('records a continuous traversal without hard scene jumps', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => document.fonts.status === 'loaded')
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  const frames = 150
  for (let frame = 0; frame <= frames; frame += 1) {
    const progress = frame / frames
    await page.evaluate(({ y }) => window.scrollTo(0, y), { y: scrollHeight * progress })
    await page.waitForTimeout(22)
  }
  await expect(page.locator('main')).toHaveAttribute('data-passage', 'still-unfinished')
})
