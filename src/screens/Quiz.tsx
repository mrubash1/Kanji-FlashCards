/**
 * Quiz — the flashcard play loop (the original's game-screen).
 *
 * Flow for the two-step ("both") quiz, per card:
 *   step 1  show the kanji, ask the MEANING.
 *   step 2  if the meaning passed, reveal it and ask the READING.
 * A card counts as correct only if BOTH steps pass; any miss schedules it back
 * to Leitner box 1 (F1). Meaning-only / reading-only decks run a single step.
 *
 * Unlike the original, missed cards are NOT re-inserted into this session — the
 * Leitner scheduler brings them back next time instead. Each card is shown once.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import AppHeader from '../components/AppHeader'
import ScoreBar from '../components/ScoreBar'
import SpeakerButton from '../components/SpeakerButton'
import QuizInput, { type QuizInputHandle } from '../components/QuizInput'
import {
  shuffle,
  formatTime,
  isMeaningCorrect,
  pointsPerCard,
  asksMeaning,
} from '../lib/game'
import { isReadingCorrect } from '../lib/kana'

type Step = 'meaning' | 'reading'

export default function Quiz() {
  const { session, levelKey, progress, markSeen, markMistake, resolveCard, finishGame, goHome } =
    useApp()

  // Shuffle once for the life of this session.
  const cards = useMemo(() => shuffle(session?.cards ?? []), [session])
  const mode = session?.phaseMode ?? 'both'
  const topicName = session?.topicName ?? ''
  const perCard = pointsPerCard(mode)
  const firstStep: Step = mode === 'reading' ? 'reading' : 'meaning'

  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step>(firstStep)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null)
  const [flash, setFlash] = useState<'' | 'correct' | 'wrong'>('')
  const [showSpeak, setShowSpeak] = useState(false)
  const [timerSec, setTimerSec] = useState(0)

  // Did the learner miss EITHER step of the current card? (no re-render needed)
  const missedRef = useRef(false)
  const meaningRef = useRef<QuizInputHandle>(null)
  const readingRef = useRef<QuizInputHandle>(null)
  const nextBtnRef = useRef<HTMLButtonElement>(null)

  const card = cards[index]
  const isLast = index === cards.length - 1
  // Total points "asked" so far = points-per-card × cards started.
  const total = card ? perCard * (index + 1) : perCard * cards.length

  // Timer: count up once per second for the whole session.
  useEffect(() => {
    const id = window.setInterval(() => setTimerSec((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Mark each card as seen when it first appears (idempotent).
  useEffect(() => {
    if (card) markSeen(levelKey, card.kanji)
  }, [card, levelKey, markSeen])

  // Keyboard flow (F8): focus the active input while answering, or the Next
  // button once an answer is revealed, so Enter always advances.
  useEffect(() => {
    if (!card) return
    const t = window.setTimeout(() => {
      if (revealed) {
        nextBtnRef.current?.focus()
      } else if (step === 'reading') {
        readingRef.current?.focus()
      } else {
        meaningRef.current?.focus()
      }
    }, 30)
    return () => window.clearTimeout(t)
  }, [revealed, step, index, card])

  if (!session || cards.length === 0) {
    return (
      <>
        <AppHeader title="Quiz" onBack={goHome} backLabel="Home" />
        <main className="screen">
          <div className="empty-state">
            <span className="es-emoji" aria-hidden="true">🎏</span>
            Nothing to review here yet.
            <br />
            Pick a topic to start studying.
          </div>
        </main>
      </>
    )
  }

  const prevBest = progress.personalBests[`${session.levelKey}:${topicName}`]
  const prevBestTime = prevBest ? `best ${formatTime(prevBest.bestTime)}` : ''
  const prevBestScore = prevBest ? `best ${prevBest.bestScore} / ${prevBest.bestTotal}` : ''

  // ── advance / finish ────────────────────────────────────────────────
  function endCard(passed: boolean) {
    resolveCard(levelKey, card.kanji, passed)
    if (isLast) {
      const uniqueCount = new Set(cards.map((c) => c.kanji)).size
      // `score` already reflects the last step's increment (a render happened
      // between the answer check and this Next click).
      finishGame({ score, total, timeSec: timerSec, uniqueCount })
      return
    }
    // Reset for the next card.
    setIndex((i) => i + 1)
    setStep(firstStep)
    setRevealed(false)
    setFeedback(null)
    setFlash('')
    setShowSpeak(false)
    missedRef.current = false
  }

  function onNext() {
    // In two-step mode, a correct meaning leads to the reading step.
    if (mode === 'both' && step === 'meaning' && !missedRef.current) {
      setStep('reading')
      setRevealed(false)
      setFeedback(null)
      setFlash('')
      return
    }
    endCard(!missedRef.current)
  }

  function checkMeaning() {
    const value = meaningRef.current?.getValue() ?? ''
    if (!value.trim()) return
    const correct = isMeaningCorrect(value, card)
    setFlash(correct ? 'correct' : 'wrong')
    if (correct) {
      setScore((s) => s + 1)
      setFeedback({ text: '✓ Correct!', correct: true })
    } else {
      missedRef.current = true
      markMistake(levelKey, card.kanji)
      setFeedback({ text: `✗ It means: ${card.meaning}`, correct: false })
    }
    // Single-meaning decks finish the card here; two-step continues to reading.
    setRevealed(true)
  }

  function checkReading() {
    const value = readingRef.current?.getValue() ?? ''
    if (!value.trim()) return
    const correct = isReadingCorrect(value, card)
    setFlash(correct ? 'correct' : 'wrong')
    if (correct) {
      setScore((s) => s + 1)
      setFeedback({ text: '✓ Correct!', correct: true })
    } else {
      missedRef.current = true
      markMistake(levelKey, card.kanji)
      const romajiPart = card.romaji ? `  (${card.romaji})` : ''
      setFeedback({ text: `✗ Not quite — it’s ${card.reading}${romajiPart}`, correct: false })
    }
    setShowSpeak(true)
    setRevealed(true)
  }

  const cardsLeft = cards.length - index
  const progressPct = (index / cards.length) * 100

  const phaseLabel =
    mode === 'both'
      ? step === 'meaning'
        ? 'Step 1 · Meaning'
        : 'Step 2 · Reading'
      : mode === 'meaning'
        ? 'Meaning'
        : 'Reading'

  const showMeaningText = mode === 'both' && step === 'reading'

  // Next-button label mirrors the original's contextual wording.
  let nextLabel: string
  if (mode === 'both' && step === 'meaning' && !missedRef.current) {
    nextLabel = 'Next — try the reading →'
  } else {
    nextLabel = isLast ? 'Finish →' : missedRef.current ? 'Got it — next card →' : 'Next word →'
  }

  return (
    <>
      <AppHeader title={topicName} onBack={goHome} backLabel="Quit" />
      <main className="screen" id="game-screen">
        <ScoreBar
          cardsLeft={cardsLeft}
          timerSec={timerSec}
          score={score}
          total={total}
          prevBestTime={prevBestTime}
          prevBestScore={prevBestScore}
        />
        <div className="progress-wrap">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className={`card${flash ? ` flash-${flash}` : ''}`} key={index}>
          <div className="phase-label">{phaseLabel}</div>
          <div className="kanji-display" lang="ja">
            {card.kanji}
          </div>
          {showMeaningText && <div className="english-display">{card.meaning}</div>}

          <p className="hint-text">
            {step === 'meaning'
              ? 'What does this kanji mean in English?'
              : 'Now type the reading — hiragana or romaji both work!'}
          </p>

          <div className="feedback" role="status" aria-live="polite">
            {feedback && (
              <span className={feedback.correct ? 'correct' : 'wrong'}>{feedback.text}</span>
            )}
          </div>

          <div className="action-bar action-bar--sticky">
            {step === 'meaning' ? (
              <QuizInput
                key={`m-${index}`}
                ref={meaningRef}
                id="meaning-input"
                kana={false}
                placeholder="e.g.  water"
                ariaLabel="Type the meaning in English"
                disabled={revealed}
                onEnter={checkMeaning}
              />
            ) : (
              <QuizInput
                key={`r-${index}`}
                ref={readingRef}
                id="reading-input"
                kana
                placeholder="e.g.  みず  or  mizu"
                ariaLabel="Type the reading in hiragana or romaji"
                disabled={revealed}
                onEnter={checkReading}
              />
            )}

            {!revealed ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={asksMeaning(mode) && step === 'meaning' ? checkMeaning : checkReading}
              >
                Check →
              </button>
            ) : (
              <>
                {showSpeak && card.reading && (
                  <SpeakerButton reading={card.reading} label="Hear pronunciation" />
                )}
                <button
                  ref={nextBtnRef}
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={onNext}
                >
                  {nextLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
