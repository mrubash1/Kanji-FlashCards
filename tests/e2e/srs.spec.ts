import { test, expect } from '@playwright/test'
import { installSpeechMock } from './helpers/speech-mock'

/**
 * The Review-due flow (SRS). We seed a saved blob with one N5 card (水) already
 * due, then assert the topic screen offers a "Review due cards" action that
 * starts a session containing exactly that card.
 */
function seedWithDueCard(now: number) {
  return JSON.stringify({
    schemaVersion: 1,
    progress: {
      cardStates: { 'N5:水': { box: 2, due: now - 1000, lastReviewed: now - 1000 } },
      cardStatus: { 'N5:水': 'green' },
      seenByLevel: { N5: ['水'] },
      mistakeByLevel: {},
      personalBests: {},
      globalTotalScore: 0,
      globalTotalAsked: 0,
      globalSessions: 0,
    },
    decks: [],
    savedAt: now - 1000,
  })
}

test.describe('SRS review-due flow', () => {
  test('topic screen offers a due-review session that plays the due card', async ({ page }) => {
    await installSpeechMock(page)
    const now = Date.now()
    await page.addInitScript((blob) => localStorage.setItem('kanjiflash-progress', blob), seedWithDueCard(now))

    await page.goto('/')
    await page.locator('.level-card').first().click() // N5
    await expect(page.locator('#topic-screen')).toBeVisible()

    const review = page.getByRole('button', { name: /Review 1 due card/ })
    await expect(review).toBeVisible()
    await review.click()

    await expect(page.locator('#game-screen')).toBeVisible()
    await expect(page.locator('.kanji-display')).toHaveText('水')
  })

  test('shows a "nothing due" message when no cards are due', async ({ page }) => {
    await installSpeechMock(page)
    await page.addInitScript(() =>
      localStorage.setItem(
        'kanjiflash-progress',
        JSON.stringify({
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
        }),
      ),
    )
    await page.goto('/')
    await page.locator('.level-card').first().click()
    await expect(page.getByText(/Nothing due right now/)).toBeVisible()
  })
})
