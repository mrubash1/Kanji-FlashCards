/**
 * AppContext — the app's shared brain.
 *
 * The original single-file app kept everything in module-level `let` variables
 * and switched screens with `showScreen(id)`. This context preserves that exact
 * mental model, just typed and React-friendly:
 *
 *   - `screen`  is the typed equivalent of the old `.active` class.
 *   - `progress`/`decks` mirror what the old code saved to localStorage.
 *   - small, well-named methods replace the old free functions
 *     (selectLevel, startGame, markCleared, saveProgress, …).
 *
 * One screen is visible at a time (see App.tsx). Persistence is automatic: any
 * change to `progress` or `decks` is written back to localStorage by an effect.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Deck,
  GameResult,
  Level,
  Mastery,
  PersonalBest,
  Progress,
  Screen,
  SessionConfig,
  StorageBlob,
} from '../types'
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  loadBlob,
  saveBlob,
  exportToJson,
  parseImport,
} from '../lib/storage'
import { gradeCard, initialCardState } from '../lib/scheduler'
import { createSpeechController, type SpeechController } from '../lib/speech'
import { makeDeckId } from '../lib/game'
import { cardKey } from '../lib/keys'

interface AppContextValue {
  screen: Screen
  navigate: (screen: Screen) => void

  level: Level
  /** The active level key (built-in level or `custom:<id>`). */
  levelKey: string

  progress: Progress
  decks: Deck[]
  speech: SpeechController
  /** Reactive mirror of `speech.isAvailable` (flips when voices load late). */
  speechAvailable: boolean

  session: SessionConfig | null
  result: GameResult | null

  // ── navigation flows ──────────────────────────────────────────────
  selectLevel: (level: Level) => void
  startSession: (cfg: SessionConfig) => void
  finishGame: (args: { score: number; total: number; timeSec: number; uniqueCount: number }) => void
  goHome: () => void

  // ── progress updates during play ──────────────────────────────────
  markSeen: (levelKey: string, kanji: string) => void
  markMistake: (levelKey: string, kanji: string) => void
  /** Record the result of one finished card: set mastery + grade the scheduler. */
  resolveCard: (levelKey: string, kanji: string, passed: boolean) => void

  // ── custom decks ──────────────────────────────────────────────────
  /** The deck currently open in the editor (a draft until first saved). */
  editingDeck: Deck | null
  openNewDeck: () => void
  openDeck: (id: string) => void
  saveDeck: (deck: Deck) => void
  deleteDeck: (id: string) => void

  // ── data export / import (F4) ─────────────────────────────────────
  exportData: () => void
  importData: (text: string) => { ok: boolean; error?: string }

  // ── toast ─────────────────────────────────────────────────────────
  toast: string | null
  showToast: (message: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

/** Was there ever a save? Decides first-run onboarding (F7). */
function hasExistingSave(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Load once, synchronously, before first paint.
  const initial = useRef<StorageBlob>(loadBlob()).current

  const [screen, setScreen] = useState<Screen>(hasExistingSave() ? 'level' : 'onboarding')
  const [level, setLevelState] = useState<Level>('N5')
  const [levelKey, setLevelKey] = useState<string>('N5')
  const [progress, setProgress] = useState<Progress>(initial.progress)
  const [decks, setDecks] = useState<Deck[]>(initial.decks)
  const [session, setSession] = useState<SessionConfig | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // One speech controller for the whole app lifetime.
  const speech = useMemo(() => createSpeechController(), [])
  const [speechAvailable, setSpeechAvailable] = useState(speech.isAvailable)
  useEffect(() => {
    setSpeechAvailable(speech.isAvailable)
    return speech.onAvailabilityChange(setSpeechAvailable)
  }, [speech])

  // Ask the browser to keep our localStorage from being evicted (best-effort).
  // Without this, mobile Safari/Chrome can clear an unused PWA's storage after a
  // week, silently wiping progress. No-op where unsupported.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => {})
  }, [])

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }, [])

  // Persist progress + decks whenever they change (the original's automatic
  // saveProgress). We skip the initial mount (nothing changed yet, no point
  // re-stamping savedAt) and surface a quota failure as a toast so a learner
  // whose storage is full finds out instead of silently losing progress.
  const isFirstSave = useRef(true)
  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false
      return
    }
    const ok = saveBlob({ schemaVersion: SCHEMA_VERSION, progress, decks, savedAt: Date.now() })
    if (!ok) showToast('⚠ Couldn’t save — device storage may be full')
  }, [progress, decks, showToast])

  const navigate = useCallback((next: Screen) => setScreen(next), [])

  const selectLevel = useCallback((next: Level) => {
    setLevelState(next)
    setLevelKey(next)
    setScreen('topic')
  }, [])

  const startSession = useCallback((cfg: SessionConfig) => {
    setLevelKey(cfg.levelKey)
    setSession(cfg)
    setScreen('quiz')
  }, [])

  const goHome = useCallback(() => setScreen('level'), [])

  // ── progress mutators (immutable updates → effect persists) ─────────
  const markSeen = useCallback((lk: string, kanji: string) => {
    setProgress((p) => {
      const list = p.seenByLevel[lk] ?? []
      if (list.includes(kanji)) return p
      return { ...p, seenByLevel: { ...p.seenByLevel, [lk]: [...list, kanji] } }
    })
  }, [])

  const markMistake = useCallback((lk: string, kanji: string) => {
    setProgress((p) => {
      const list = p.mistakeByLevel[lk] ?? []
      if (list.includes(kanji)) return p
      return { ...p, mistakeByLevel: { ...p.mistakeByLevel, [lk]: [...list, kanji] } }
    })
  }, [])

  const resolveCard = useCallback((lk: string, kanji: string, passed: boolean) => {
    const now = Date.now()
    const key = cardKey(lk, kanji)
    setProgress((p) => {
      // Leitner grade: both steps passing = correct; any miss resets to box 1.
      const prevState = p.cardStates[key] ?? initialCardState(now)
      const nextState = gradeCard(prevState, passed, now)
      // Mastery colour mirrors the original: green = cleared cleanly,
      // yellow = cleared/attempted with a slip.
      const mastery: Mastery = passed ? 'green' : 'yellow'
      return {
        ...p,
        cardStates: { ...p.cardStates, [key]: nextState },
        cardStatus: { ...p.cardStatus, [key]: mastery },
      }
    })
  }, [])

  const finishGame = useCallback(
    (args: { score: number; total: number; timeSec: number; uniqueCount: number }) => {
      const { score, total, timeSec, uniqueCount } = args
      // The active session and progress are read straight from the closure —
      // there's exactly one finish per session, so the closed-over values are
      // the right ones (no need for the fragile read-inside-updater trick).
      const lk = session?.levelKey ?? levelKey
      const topicName = session?.topicName ?? ''
      const topicKey = `${lk}:${topicName}`

      const prev = progress.personalBests[topicKey]
      const pct = total > 0 ? score / total : 0
      const prevPct = prev ? prev.bestScore / prev.bestTotal : -1
      let newBestScore = false
      let newBestTime = false
      let pb: PersonalBest
      if (!prev) {
        pb = { bestScore: score, bestTotal: total, bestTime: timeSec }
      } else {
        pb = { ...prev }
        if (pct > prevPct || (pct === prevPct && score > prev.bestScore)) {
          pb.bestScore = score
          pb.bestTotal = total
          newBestScore = true
        }
        if (timeSec < prev.bestTime) {
          pb.bestTime = timeSec
          newBestTime = true
        }
      }

      const computed: GameResult = {
        levelKey: lk,
        topicName,
        score,
        total,
        timeSec,
        uniqueCount,
        pb,
        isFirstAttempt: !prev,
        newBestScore,
        newBestTime,
      }

      setProgress((p) => ({
        ...p,
        personalBests: { ...p.personalBests, [topicKey]: pb },
        globalSessions: p.globalSessions + 1,
        globalTotalScore: p.globalTotalScore + score,
        globalTotalAsked: p.globalTotalAsked + total,
      }))
      setResult(computed)
      setScreen('results')
    },
    [session, levelKey, progress],
  )

  // ── custom decks ────────────────────────────────────────────────────
  const openNewDeck = useCallback(() => {
    // A blank draft. It only joins `decks` (and persists) once the user saves.
    setEditingDeck({ id: makeDeckId(), name: '', phaseMode: 'both', cards: [] })
    setScreen('deckEditor')
  }, [])

  const openDeck = useCallback(
    (id: string) => {
      setEditingDeck(decks.find((d) => d.id === id) ?? null)
      setScreen('deckEditor')
    },
    [decks],
  )

  const saveDeck = useCallback((deck: Deck) => {
    setDecks((list) => {
      const exists = list.some((d) => d.id === deck.id)
      return exists ? list.map((d) => (d.id === deck.id ? deck : d)) : [...list, deck]
    })
  }, [])

  const deleteDeck = useCallback((id: string) => {
    setDecks((list) => list.filter((d) => d.id !== id))
  }, [])

  // ── export / import (F4) ────────────────────────────────────────────
  const exportData = useCallback(() => {
    const blob: StorageBlob = {
      schemaVersion: SCHEMA_VERSION,
      progress,
      decks,
      savedAt: Date.now(),
    }
    const json = exportToJson(blob)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `kanji-flash-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [progress, decks])

  const importData = useCallback((text: string): { ok: boolean; error?: string } => {
    const res = parseImport(text)
    if (!res.ok) return { ok: false, error: res.error }
    setProgress(res.blob.progress)
    setDecks(res.blob.decks)
    return { ok: true }
  }, [])

  const value: AppContextValue = {
    screen,
    navigate,
    level,
    levelKey,
    progress,
    decks,
    speech,
    speechAvailable,
    session,
    result,
    selectLevel,
    startSession,
    finishGame,
    goHome,
    markSeen,
    markMistake,
    resolveCard,
    editingDeck,
    openNewDeck,
    openDeck,
    saveDeck,
    deleteDeck,
    exportData,
    importData,
    toast,
    showToast,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/** Hook to read the app context. Throws if used outside the provider. */
// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within <AppProvider>')
  return ctx
}
