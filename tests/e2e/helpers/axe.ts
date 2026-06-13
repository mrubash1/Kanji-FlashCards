import { AxeBuilder } from '@axe-core/playwright'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * WCAG tags we audit against. Covers Level A + AA for both WCAG 2.0 and 2.1,
 * which is the practical baseline for an accessible web app.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

/**
 * Run an axe-core accessibility scan on the current page state and assert there
 * are zero violations. On failure, the assertion message lists each violation's
 * rule id, impact, help URL, and the offending DOM nodes so Phase-4 a11y
 * failures are debuggable straight from the test output.
 *
 * @param page    The Playwright page to scan (scan its current DOM state).
 * @param context Optional label (e.g. "quiz screen") included in the message.
 */
export async function expectNoA11yViolations(page: Page, context?: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze()

  const { violations } = results
  const label = context ? ` (${context})` : ''

  const detail = violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => {
          const target = n.target.join(', ')
          const summary = n.failureSummary?.trim().replace(/\n+/g, ' ') ?? ''
          return `      - ${target}${summary ? `  →  ${summary}` : ''}`
        })
        .join('\n')
      return [
        `  • [${v.impact ?? 'n/a'}] ${v.id}: ${v.help}`,
        `    ${v.helpUrl}`,
        nodes,
      ].join('\n')
    })
    .join('\n\n')

  const message =
    `Expected no accessibility violations${label}, but found ${violations.length}:\n\n${detail}`

  expect(violations, message).toEqual([])
}
