/**
 * Web Speech API wrapper for reading Japanese aloud (spec F2).
 *
 * The browser's `speechSynthesis` is famously awkward to use directly:
 *
 *  - The list of voices loads *asynchronously*. The very first `getVoices()`
 *    call often returns `[]`, and the voices only appear later.
 *  - Chrome and Firefox announce that arrival with a `voiceschanged` event.
 *  - Safari historically *never* fires `voiceschanged`, so an event-only
 *    strategy leaves Safari users permanently without a Japanese voice.
 *  - On the server (SSR) or in very old browsers there is no `speechSynthesis`
 *    at all, so any reference to it throws.
 *
 * This module hides all of that behind a small, fully-typed `SpeechController`.
 * The UI just asks `isAvailable` to decide whether to show a speaker button,
 * subscribes via `onAvailabilityChange` so a late-loading voice can reveal the
 * button, and calls `speak(reading)` from inside a user gesture.
 *
 * The original app inlined this logic and only listened for `voiceschanged`,
 * so Japanese audio silently failed on Safari. We fix that with an additional
 * timed poll, and we make everything testable by allowing the `SpeechSynthesis`
 * object (and the poll schedule) to be injected.
 */

/**
 * The public surface the UI depends on. Implementations are created by
 * {@link createSpeechController}; the UI never constructs utterances itself.
 */
export interface SpeechController {
  /**
   * `true` only once a Japanese (`lang` starting with "ja") voice has been
   * detected. A getter, not a plain field, because availability can flip from
   * `false` to `true` after voices load late.
   */
  readonly isAvailable: boolean

  /**
   * Speak `text` in Japanese. No-op when no Japanese voice is available or when
   * `text` is empty. Cancels any in-flight utterance first so rapid taps don't
   * queue up a backlog of audio. Must be called from a user gesture — this
   * never autoplays on its own.
   */
  speak(text: string): void

  /** Stop any current speech. Safe to call when nothing is playing. */
  cancel(): void

  /**
   * Subscribe to availability changes. The callback fires only when the value
   * actually flips (not on every detection attempt). Returns an unsubscribe
   * function; call it to stop listening (e.g. on component unmount).
   */
  onAvailabilityChange(cb: (available: boolean) => void): () => void

  /**
   * Tear down: remove the `voiceschanged` listener, cancel pending voice polls,
   * and drop all subscribers. Call when the controller is no longer needed so it
   * leaves no dangling listeners or timers.
   */
  dispose(): void
}

/** Tunable knobs, mainly so tests can drive the poll on fake timers. */
export interface SpeechControllerOptions {
  /**
   * When, in milliseconds after init, to re-poll `getVoices()` for the benefit
   * of browsers (Safari) that never fire `voiceschanged`. Polling stops early
   * the moment a Japanese voice is found. Defaults to a short back-off so the
   * common case (voices already present, or `voiceschanged` fires) costs almost
   * nothing, while a slow browser still gets several chances within ~2s.
   */
  pollDelays?: readonly number[]
}

/** Default poll schedule: quick early retries, then back off, capped at ~2s. */
const DEFAULT_POLL_DELAYS: readonly number[] = [250, 500, 1000, 2000]

/** Rate is a touch slower than 1.0 so learners can follow the reading. */
const SPEECH_RATE = 0.85

/** Fixed BCP-47 tag for the utterance; the matched voice may be more specific. */
const SPEECH_LANG = 'ja-JP'

/** A voice is "Japanese" if its `lang` starts with "ja" (e.g. "ja", "ja-JP"). */
function isJapaneseVoice(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith('ja')
}

/**
 * A controller that does nothing, returned when there is no `speechSynthesis`
 * (SSR / ancient browsers). It satisfies the interface so callers never need to
 * null-check — `isAvailable` is permanently `false` and the rest are no-ops.
 */
function createNoopController(): SpeechController {
  return {
    get isAvailable() {
      return false
    },
    speak() {
      /* no voice engine — nothing to do */
    },
    cancel() {
      /* no voice engine — nothing to do */
    },
    onAvailabilityChange() {
      // Availability can never change, so we never call back. Still return a
      // valid unsubscribe so callers can wire it up unconditionally.
      return () => {}
    },
    dispose() {
      /* nothing was ever set up */
    },
  }
}

/**
 * Build a {@link SpeechController} around a `SpeechSynthesis` instance.
 *
 * @param synth Defaults to the global `speechSynthesis`. Inject a fake in tests.
 *   If it is missing (SSR / old browser), a permanently-unavailable no-op
 *   controller is returned.
 * @param options Optional tuning, chiefly the poll schedule.
 */
export function createSpeechController(
  synth: SpeechSynthesis | undefined = globalThis.speechSynthesis,
  options: SpeechControllerOptions = {},
): SpeechController {
  // Guard: no engine → safe no-op controller. Doing this up front means the
  // rest of the function can treat `synth` as definitely present.
  if (!synth) {
    return createNoopController()
  }

  const pollDelays = options.pollDelays ?? DEFAULT_POLL_DELAYS

  // The currently-detected Japanese voice, or null if none found yet. We keep
  // the voice itself (not just a boolean) so `speak` can pin `.voice` to it.
  let japaneseVoice: SpeechSynthesisVoice | null = null

  // Subscribers to availability changes. A Set makes unsubscribe O(1) and
  // guards against the same callback being added twice.
  const listeners = new Set<(available: boolean) => void>()

  /**
   * Re-read the voice list and update `japaneseVoice`. Returns whether the
   * voice list now contains a Japanese voice — handy for stopping the poll.
   */
  function detect(): boolean {
    const voices = synth!.getVoices()
    japaneseVoice = voices.find(isJapaneseVoice) ?? null
    return japaneseVoice !== null
  }

  /**
   * Run detection and, if availability actually changed since `previous`,
   * notify every subscriber. Subscribers see at most one call per real flip.
   */
  function detectAndNotify(previous: boolean): void {
    const now = detect()
    if (now !== previous) {
      for (const cb of listeners) cb(now)
    }
  }

  // --- Initial synchronous detection. Often empty on first paint. -----------
  detect()

  // --- Strategy 1: the standard event. Chrome/Firefox fire this when the -----
  // voice list is ready (and again if the OS voice set changes).
  const onVoicesChanged = () => detectAndNotify(japaneseVoice !== null)
  synth.addEventListener('voiceschanged', onVoicesChanged)

  // --- Strategy 2: timed polling for Safari, which never fires the event. ----
  // We schedule independent timeouts and bail out of each one early once a
  // voice is found, so a fast browser pays almost nothing. We don't unify these
  // into a single self-rescheduling chain because independent timeouts keep the
  // schedule explicit and trivially advanceable with fake timers in tests.
  const timers: ReturnType<typeof setTimeout>[] = []
  for (const delay of pollDelays) {
    timers.push(
      setTimeout(() => {
        if (japaneseVoice !== null) return // already found — skip this tick
        detectAndNotify(japaneseVoice !== null) // notify on a real false→true flip
      }, delay),
    )
  }

  return {
    get isAvailable() {
      return japaneseVoice !== null
    },

    speak(text: string) {
      // No voice, or nothing meaningful to say → do nothing.
      if (japaneseVoice === null || text.length === 0) return

      // Cancel any in-flight utterance so rapid taps replace rather than queue.
      synth!.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = SPEECH_LANG
      utterance.rate = SPEECH_RATE
      utterance.voice = japaneseVoice
      synth!.speak(utterance)
    },

    cancel() {
      synth!.cancel()
    },

    onAvailabilityChange(cb: (available: boolean) => void) {
      listeners.add(cb)
      // Unsubscribe simply forgets the callback.
      return () => {
        listeners.delete(cb)
      }
    },

    dispose() {
      synth!.removeEventListener('voiceschanged', onVoicesChanged)
      for (const id of timers) clearTimeout(id)
      listeners.clear()
    },
  }
}
