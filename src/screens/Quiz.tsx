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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  // Re-entrancy guards against fast/double Enter: `answeredRef` blocks a second
  // check of the same step; `finishedRef` blocks a second finish of the game.
  const answeredRef = useRef(false)
  const finishedRef = useRef(false)
  // Mirror of `score` read synchronously at finish (state may lag a keystroke).
  const scoreRef = useRef(0)
  const meaningRef = useRef<QuizInputHandle>(null)
  const readingRef = useRef<QuizInputHandle>(null)
  const nextBtnRef = useRef<HTMLButtonElement>(null)

  const card = cards[index]
  const isLast = index === cards.length - 1
  // Total points "asked" so far = points-per-card × cards started.
  const total = card ? perCard * (index + 1) : perCard * cards.length

  // Timer: wall-clock based so it can't drift or pause when the tab is
  // backgrounded (which would make "best time" unfair). We stamp a start time
  // once and recompute elapsed each tick and at finish.
  const startedAtRef = useRef<number | null>(null)
  if (startedAtRef.current === null) startedAtRef.current = Date.now()
  const elapsedSec = () => Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)
  useEffect(() => {
    const id = window.setInterval(() => setTimerSec(elapsedSec()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Mark each card as seen when it first appears (idempotent).
  useEffect(() => {
    if (card) markSeen(levelKey, card.kanji)
  }, [card, levelKey, markSeen])

  // Keyboard flow (F8): focus the active input while answering, or the Next
  // button once an answer is revealed, so Enter always advances. useLayoutEffect
  // moves focus synchronously after the DOM commit — no ~30ms window where focus
  // sits on <body> and a keystroke is dropped.
  useLayoutEffect(() => {
    if (!card) return
    if (revealed) {
      nextBtnRef.current?.focus()
    } else if (step === 'reading') {
      readingRef.current?.focus()
    } else {
      meaningRef.current?.focus()
    }
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

  function bumpScore() {
    scoreRef.current += 1
    setScore(scoreRef.current)
  }

  // ── advance / finish ────────────────────────────────────────────────
  function endCard(passed: boolean) {
    // Guard: a held/double Enter must never finish the game twice (which would
    // double-count the session and re-add the score).
    if (finishedRef.current) return
    resolveCard(levelKey, card.kanji, passed)
    if (isLast) {
      finishedRef.current = true
      const uniqueCount = new Set(cards.map((c) => c.kanji)).size
      // Read the score from the ref so a keystroke that out-runs React's render
      // can't finish with a stale value.
      finishGame({ score: scoreRef.current, total, timeSec: elapsedSec(), uniqueCount })
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
    answeredRef.current = false
  }

  function onNext() {
    // In two-step mode, a correct meaning leads to the reading step.
    if (mode === 'both' && step === 'meaning' && !missedRef.current) {
      setStep('reading')
      setRevealed(false)
      setFeedback(null)
      setFlash('')
      answeredRef.current = false // the reading step hasn't been answered yet
      return
    }
    endCard(!missedRef.current)
  }

  function checkMeaning() {
    if (answeredRef.current) return // ignore a second check of the same step
    const value = meaningRef.current?.getValue() ?? ''
    if (!value.trim()) return
    answeredRef.current = true
    const correct = isMeaningCorrect(value, card)
    setFlash(correct ? 'correct' : 'wrong')
    if (correct) {
      bumpScore()
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
    if (answeredRef.current) return
    const value = readingRef.current?.getValue() ?? ''
    if (!value.trim()) return
    answeredRef.current = true
    const correct = isReadingCorrect(value, card)
    setFlash(correct ? 'correct' : 'wrong')
    if (correct) {
      bumpScore()
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
