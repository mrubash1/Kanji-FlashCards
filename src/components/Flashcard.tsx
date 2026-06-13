/**
 * Flashcard — the presentational card face shown during the quiz.
 *
 * Purely visual: it renders the bordered card box (with its green/red feedback
 * flash and slide-in animation), the phase label, the big kanji, the revealed
 * meaning (two-step reading phase only), the hint, and the feedback line. The
 * interactive bits (answer input, Check/Next buttons, speaker) are passed in as
 * `children`, so all quiz STATE stays in Quiz.tsx and this component stays a
 * dumb, reusable view — easy to read and to reason about.
 */
import type { ReactNode } from 'react'

interface FlashcardProps {
  kanji: string
  phaseLabel: string
  /** The English meaning, shown only when the parent wants it revealed. */
  meaning?: string
  hint: string
  /** Feedback after an answer is checked, or null while answering. */
  feedback: { text: string; correct: boolean } | null
  /** Border flash: '' none, 'correct' green, 'wrong' red. */
  flash: '' | 'correct' | 'wrong'
  /** The interactive answer area (input + buttons + speaker). */
  children: ReactNode
}

export default function Flashcard({
  kanji,
  phaseLabel,
  meaning,
  hint,
  feedback,
  flash,
  children,
}: FlashcardProps) {
  return (
    <div className={`card${flash ? ` flash-${flash}` : ''}`}>
      <div className="phase-label">{phaseLabel}</div>
      <div className="kanji-display" lang="ja">
        {kanji}
      </div>
      {meaning !== undefined && <div className="english-display">{meaning}</div>}

      <p className="hint-text">{hint}</p>

      <div className="feedback" role="status" aria-atomic="true">
        {feedback && <span className={feedback.correct ? 'correct' : 'wrong'}>{feedback.text}</span>}
      </div>

      {children}
    </div>
  )
}
