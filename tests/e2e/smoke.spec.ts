import { test, expect } from '@playwright/test'
import { installSpeechMock } from './helpers/speech-mock'

/**
 * Seed a valid (but otherwise empty) storage blob so the app skips onboarding
 * and lands on the Level screen. Must run before page.goto.
 */
const SEED_BLOB = {
  schemaVersion: 1,
  progress: {
    cardStates: {},
    cardStatus: {},
    seenByLevel: {},
    mistakeByLevel: {},
    personalBests: {},
    globalTotalScore: 0,
    globalTotalAsked: 0,
    globalSessions: 0,
  },
  decks: [],
  savedAt: 1,
}

async function seedSkipOnboarding(page: import('@playwright/test').Page, blob: unknown = SEED_BLOB) {
  await page.addInitScript((b) => {
    localStorage.setItem('kanjiflash-progress', JSON.stringify(b))
  }, blob)
}

test.describe('smoke', () => {
  test('first run shows onboarding', async ({ page }) => {
    await installSpeechMock(page)
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')

    await expect(page.locator('.logo')).toBeVisible()
    await expect(page.locator('.logo')).toHaveText('漢字')
    await expect(page.getByRole('button', { name: /Get started/ })).toBeVisible()
  })

  test('seeded storage renders the level picker with unlocked + locked levels', async ({ page }) => {
    await installSpeechMock(page)
    await seedSkipOnboarding(page)
    await page.goto('/')

    await expect(page.locator('#level-screen')).toBeVisible()

    const cards = page.locator('.level-card')
    // N5, N4, three locked, plus the "My Decks" custom card.
    await expect(cards).toHaveCount(6)

    await expect(page.locator('.level-card').filter({ hasText: 'N5' })).toBeVisible()
    await expect(page.locator('.level-card').filter({ hasText: 'N4' })).toBeVisible()

    // Three locked levels, all disabled.
    const locked = page.locator('.level-card.locked')
    await expect(locked).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      await expect(locked.nth(i)).toBeDisabled()
    }

    await expect(page.locator('.level-card.custom-card')).toContainText('My Decks')
  })

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    await installSpeechMock(page)
    await seedSkipOnboarding(page)
    await page.goto('/')

    await expect(page.locator('#level-screen')).toBeVisible()
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
  })
})
