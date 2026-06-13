import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installSpeechMock } from './helpers/speech-mock'

/**
 * A seeded blob carrying one custom deck whose answers we know, so the quiz is
 * deterministic. Cards: 水→water/みず, 火→fire/ひ. Two-step ("both") mode.
 */
function seedBlob() {
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
    decks: [
      {
        id: 't1',
        name: 'T1',
        phaseMode: 'both',
        cards: [
          { kanji: '水', meaning: 'water', reading: 'みず' },
          { kanji: '火', meaning: 'fire', reading: 'ひ' },
        ],
      },
    ],
    savedAt: 1,
  }
}

const MEANINGS: Record<string, string> = { 水: 'water', 火: 'fire' }
const READINGS_ROMAJI: Record<string, string> = { 水: 'mizu', 火: 'hi' }

async function setup(page: Page) {
  await installSpeechMock(page)
  await page.addInitScript((b) => {
    localStorage.setItem('kanjiflash-progress', JSON.stringify(b))
  }, seedBlob())
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
}

/** From the level screen, open My Decks and start playing the seeded deck. */
async function startPlaying(page: Page) {
  await expect(page.locator('#level-screen')).toBeVisible()
  await page.locator('.level-card.custom-card').click()
  await expect(page.locator('#deck-list-screen')).toBeVisible()
  await page.locator('.deck-row').getByRole('button', { name: '▶ Play' }).click()
  await expect(page.locator('#game-screen')).toBeVisible()
}

test.describe('quiz flow', () => {
  test('completes a correct two-step card', async ({ page }) => {
    await setup(page)
    await startPlaying(page)

    await expect(page.locator('.phase-label')).toHaveText('Step 1 · Meaning')

    const kanji = (await page.locator('.kanji-display').textContent())?.trim() ?? ''
    expect(Object.keys(MEANINGS)).toContain(kanji)

    // Step 1: meaning.
    await page.locator('#meaning-input').fill(MEANINGS[kanji])
    await page.getByRole('button', { name: 'Check →' }).click()
    await expect(page.locator('.feedback span')).toHaveText('✓ Correct!')

    await page.getByRole('button', { name: 'Next — try the reading →' }).click()

    // Step 2: reading. The meaning is revealed.
    await expect(page.locator('.phase-label')).toHaveText('Step 2 · Reading')
    await expect(page.locator('.english-display')).toBeVisible()

    // wanakana converts romaji → kana live.
    const readingInput = page.locator('#reading-input')
    await readingInput.type(READINGS_ROMAJI[kanji], { delay: 20 })
    await expect(readingInput).toHaveValue(kanji === '水' ? 'みず' : 'ひ')

    await page.getByRole('button', { name: 'Check →' }).click()
    await expect(page.locator('.feedback span')).toHaveText('✓ Correct!')

    // Speaker pill shows after the reading is revealed (ja-JP voice mocked).
    await expect(page.locator('.sound-btn')).toBeVisible()
  })

  test('wrong meaning shows the correct answer and a recovery advance label', async ({ page }) => {
    await setup(page)
    await startPlaying(page)

    const kanji = (await page.locator('.kanji-display').textContent())?.trim() ?? ''

    await page.locator('#meaning-input').fill('definitely-wrong')
    await page.getByRole('button', { name: 'Check →' }).click()

    const fb = page.locator('.feedback span')
    await expect(fb).toHaveText(`✗ It means: ${MEANINGS[kanji]}`)

    // A miss skips the reading step and offers "Got it — next card →".
    await expect(page.getByRole('button', { name: 'Got it — next card →' })).toBeVisible()
  })

  test('finishing the deck shows results and writes scheduler state', async ({ page }) => {
    await setup(page)
    await startPlaying(page)

    // Play through both cards correctly (2 cards × 2 steps).
    for (let i = 0; i < 2; i++) {
      const kanji = (await page.locator('.kanji-display').textContent())?.trim() ?? ''

      await page.locator('#meaning-input').fill(MEANINGS[kanji])
      await page.getByRole('button', { name: 'Check →' }).click()
      await expect(page.locator('.feedback span')).toHaveText('✓ Correct!')
      await page.getByRole('button', { name: 'Next — try the reading →' }).click()

      await expect(page.locator('.phase-label')).toHaveText('Step 2 · Reading')
      await page.locator('#reading-input').type(READINGS_ROMAJI[kanji], { delay: 20 })
      await page.getByRole('button', { name: 'Check →' }).click()
      await expect(page.locator('.feedback span')).toHaveText('✓ Correct!')

      // Last card finishes; earlier card advances to the next word.
      const advance = i === 1
        ? page.getByRole('button', { name: 'Finish →' })
        : page.getByRole('button', { name: 'Next word →' })
      await advance.click()
    }

    // Results screen with the final score.
    await expect(page.locator('#end-screen')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Topic complete!' })).toBeVisible()
    await expect(page.locator('.final-score')).toHaveText('4 / 4')

    // Grading updated the Leitner schedule: cardStates now has custom:t1 entries.
    const raw = await page.evaluate(() => localStorage.getItem('kanjiflash-progress'))
    expect(raw).not.toBeNull()
    const blob = JSON.parse(raw!)
    const keys = Object.keys(blob.progress.cardStates)
    expect(keys).toContain('custom:t1:水')
    expect(keys).toContain('custom:t1:火')

    await page.getByRole('button', { name: 'Back to My Decks →' }).click()
    await expect(page.locator('#deck-list-screen')).toBeVisible()
  })
})
