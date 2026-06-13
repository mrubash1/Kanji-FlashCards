import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installSpeechMock } from './helpers/speech-mock'

/** Seeded blob with NO decks, so My Decks starts on its empty state. */
function emptyBlob() {
  return {
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
}

async function setup(page: Page) {
  await installSpeechMock(page)
  await page.addInitScript((b) => {
    localStorage.setItem('kanjiflash-progress', JSON.stringify(b))
  }, emptyBlob())
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
  await expect(page.locator('#level-screen')).toBeVisible()
  await page.locator('.level-card.custom-card').click()
  await expect(page.locator('#deck-list-screen')).toBeVisible()
}

test.describe('deck CRUD', () => {
  test('create, list, play, edit and delete a deck', async ({ page }) => {
    await setup(page)

    // Empty state.
    await expect(page.locator('.empty-state')).toContainText(/haven.t made any decks/)

    // ── Create ────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: '＋ New' }).click()
    await expect(page.locator('#deck-editor-screen')).toBeVisible()

    await page.locator('#deck-name').fill('My Test Deck')

    // Card 1.
    await page.locator('.ce-kanji').nth(0).fill('水')
    await page.locator('.ce-meaning').nth(0).fill('water')
    await page.locator('.ce-reading').nth(0).fill('みず')

    // Add a second card row and fill it.
    await page.getByRole('button', { name: /Add a card/ }).click()
    await expect(page.locator('.ce-kanji')).toHaveCount(2)
    await page.locator('.ce-kanji').nth(1).fill('火')
    await page.locator('.ce-meaning').nth(1).fill('fire')
    await page.locator('.ce-reading').nth(1).fill('ひ')

    await page.getByRole('button', { name: 'Save deck →' }).click()
    // Toast confirms the save; the editor stays put after saving.
    await expect(page.getByText('✓ Deck saved')).toBeVisible()
    await expect(page.locator('#deck-editor-screen')).toBeVisible()

    // ── List ──────────────────────────────────────────────────────────────
    // Return to My Decks via the header back button to see the saved deck.
    await page.getByRole('button', { name: /My Decks/ }).click()
    await expect(page.locator('#deck-list-screen')).toBeVisible()
    const row = page.locator('.deck-row')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('My Test Deck')
    await expect(row).toContainText('2 cards')

    // ── Play, then quit back ─────────────────────────────────────────────
    await row.getByRole('button', { name: '▶ Play' }).click()
    await expect(page.locator('#game-screen')).toBeVisible()
    // Quitting a custom-deck quiz returns to My Decks (its origin), not Levels.
    await page.getByRole('button', { name: /Quit/ }).click()
    await expect(page.locator('#deck-list-screen')).toBeVisible()

    // ── Edit → Delete ─────────────────────────────────────────────────────
    await page.locator('.deck-row').getByRole('button', { name: '✏ Edit' }).click()
    await expect(page.locator('#deck-editor-screen')).toBeVisible()
    await expect(page.locator('#deck-name')).toHaveValue('My Test Deck')

    await page.getByRole('button', { name: /Delete deck/ }).click()

    // Deck is gone — empty state returns.
    await expect(page.locator('#deck-list-screen')).toBeVisible()
    await expect(page.locator('.deck-row')).toHaveCount(0)
    await expect(page.locator('.empty-state')).toContainText(/haven.t made any decks/)
  })
})
