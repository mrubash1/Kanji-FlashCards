# e2e helpers

Reusable helpers for the Phase-4 Playwright specs (`smoke`, `quiz-flow`,
`deck-crud`, `a11y`). Import them from `../helpers/...` inside `tests/e2e`.

## Speech synthesis (`speech-mock.ts`)

Voice availability is non-deterministic across browsers/CI, so always mock it.
Both installers use `page.addInitScript`, so **call them before `page.goto(...)`**:

```ts
import { installSpeechMock, installNoJapaneseVoice } from '../helpers/speech-mock'

await installSpeechMock(page)        // one ja-JP voice → speaker buttons shown
await page.goto('/')

// ...or, to assert speaker buttons are hidden when no Japanese voice exists:
await installNoJapaneseVoice(page)   // only an en-US voice
await page.goto('/')
```

## Accessibility (`axe.ts`)

```ts
import { expectNoA11yViolations } from '../helpers/axe'

await expectNoA11yViolations(page)              // scans current DOM (WCAG A + AA)
await expectNoA11yViolations(page, 'quiz screen') // label appears in failures
```

## First-run / onboarding tests

The app persists state in `localStorage`. For onboarding/first-run specs, start
from a clean slate before the app boots — either clear storage via an init
script, or use an isolated `browser.newContext()` per test:

```ts
await page.addInitScript(() => localStorage.clear())
await page.goto('/')
```
