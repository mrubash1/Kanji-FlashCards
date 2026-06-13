/**
 * Onboarding (F7) — the first-run flow. Two short steps:
 *   1. a brief value statement, then
 *   2. a level choice (defaulting to N5).
 * Choosing a level starts a quiz immediately, so a new learner reaches their
 * first card in two taps. Shown only when there is no saved data.
 */
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { TOPICS } from '../data/cards'
import { buildTopicSession } from '../lib/game'
import type { Level } from '../types'

export default function Onboarding() {
  const { startSession, selectLevel } = useApp()
  const [step, setStep] = useState(0)

  // Start with the first topic of the chosen level → first card right away.
  const start = (level: Level) => startSession(buildTopicSession(level, TOPICS[level][0]))

  if (step === 0) {
    return (
      <main className="screen" id="onboarding">
        <div className="logo" aria-hidden="true">
          漢字
        </div>
        <h1 className="title">Kanji Flash</h1>
        <div className="welcome-points">
          <p className="welcome-point">
            <span className="wp-icon" aria-hidden="true">
              👀
            </span>
            <span>
              See a kanji, type what it <strong>means</strong>, then how it’s{' '}
              <strong>read</strong>.
            </span>
          </p>
          <p className="welcome-point">
            <span className="wp-icon" aria-hidden="true">
              🔁
            </span>
            <span>
              Spaced repetition brings cards back <span className="wp-dim">right when you’re about to forget them.</span>
            </span>
          </p>
          <p className="welcome-point">
            <span className="wp-icon" aria-hidden="true">
              🔊
            </span>
            <span>
              Hear every word spoken aloud <span className="wp-dim">and build your own decks too.</span>
            </span>
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
          Get started →
        </button>
      </main>
    )
  }

  return (
    <main className="screen" id="onboarding-level">
      <h1 className="title">Pick your level</h1>
      <p className="subtitle">JLPT levels run from N5 (easiest) to N1 (hardest). Start at N5.</p>
      <div className="level-grid">
        <button type="button" className="level-card" onClick={() => start('N5')}>
          <span className="lvl-badge">N5</span>
          <span className="lvl-info">
            <span className="lvl-name">Beginner</span>
            <span className="lvl-desc">80 essential kanji · recommended</span>
          </span>
          <span className="lvl-arrow" aria-hidden="true">
            →
          </span>
        </button>
        <button type="button" className="level-card" onClick={() => start('N4')}>
          <span className="lvl-badge">N4</span>
          <span className="lvl-info">
            <span className="lvl-name">Elementary</span>
            <span className="lvl-desc">164 kanji · once N5 feels easy</span>
          </span>
          <span className="lvl-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
      <button type="button" className="header-btn header-btn--ghost" onClick={() => selectLevel('N5')}>
        Browse all topics instead
      </button>
    </main>
  )
}
