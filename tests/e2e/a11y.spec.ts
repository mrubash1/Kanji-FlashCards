import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { installSpeechMock, installNoJapaneseVoice } from './helpers/speech-mock'
import { expectNoA11yViolations } from './helpers/axe'

/** Seeded blob with one known custom deck for quiz/editor navigation. */
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

async function seed(page: Page) {
  await page.addInitScript((b) => {
    localStorage.setItem('kanjiflash-progress', JSON.stringify(b))
  }, seedBlob())
  page.on('dialog', (d) => d.accept())
}

/** Navigate from the level screen into the seeded deck's quiz. */
async function intoQuiz(page: Page) {
  await expect(page.locator('#level-screen')).toBeVisible()
  await page.locator('.level-card.custom-card').click()
  await page.locator('.deck-row').getByRole('button', { name: '▶ Play' }).click()
  await expect(page.locator('#game-screen')).toBeVisible()
}

const MEANINGS: Record<string, string> = { 水: 'water', 火: 'fire' }

/** Answer the meaning step correctly and advance to the reading reveal. */
async function reachReadingReveal(page: Page) {
  const kanji = (await page.locator('.kanji-display').textContent())?.trim() ?? ''
  await page.locator('#meaning-input').fill(MEANINGS[kanji])
  await page.getByRole('button', { name: 'Check →' }).click()
  await page.getByRole('button', { name: 'Next — try the reading →' }).click()
  await expect(page.locator('.phase-label')).toHaveText('Step 2 · Reading')
  // Reveal the reading answer.
  const romaji = kanji === '水' ? 'mizu' : 'hi'
  await page.locator('#reading-input').type(romaji, { delay: 20 })
  await page.getByRole('button', { name: 'Check →' }).click()
  await expect(page.locator('.feedback span')).toBeVisible()
}

test.describe('accessibility', () => {
  test('onboarding screen has no a11y violations', async ({ page }) => {
    await installSpeechMock(page)
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
    await expect(page.locator('.logo')).toBeVisible()
    await expectNoA11yViolations(page, 'onboarding')
  })

  test('quiz screen has no a11y violations', async ({ page }) => {
    await installSpeechMock(page)
    await seed(page)
    await page.goto('/')
    await intoQuiz(page)
    await expectNoA11yViolations(page, 'quiz')
  })

  test('deck editor has no a11y violations', async ({ page }) => {
    await installSpeechMock(page)
    await seed(page)
    await page.goto('/')
    await expect(page.locator('#level-screen')).toBeVisible()
    await page.locator('.level-card.custom-card').click()
    await page.getByRole('button', { name: '＋ New' }).click()
    await expect(page.locator('#deck-editor-screen')).toBeVisible()
    await expectNoA11yViolations(page, 'deck editor')
  })

  test('speaker button is disabled with an explanatory tooltip when no ja-JP voice exists', async ({
    page,
  }) => {
    await installNoJapaneseVoice(page)
    await seed(page)
    await page.goto('/')
    await intoQuiz(page)
    await reachReadingReveal(page)

    // No Japanese voice → the button is NOT silently hidden; it's present but
    // disabled, with a tooltip + accessible label explaining why (F2: "no
    // silent failures").
    const speaker = page.locator('.sound-btn')
    await expect(speaker).toBeVisible()
    await expect(speaker).toBeDisabled()
    await expect(speaker).toHaveAttribute('title', /Audio unavailable/i)
  })
})
