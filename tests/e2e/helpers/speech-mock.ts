import type { Page } from '@playwright/test'

/**
 * Speech synthesis mocking for e2e.
 *
 * Real `speechSynthesis`/voice availability is non-deterministic across
 * browsers and CI environments (webkit in particular loads voices async and
 * exposes a different set than chromium). These helpers install a deterministic
 * fake via `page.addInitScript`, so it is in place BEFORE any app code runs —
 * call them before `page.goto(...)`.
 *
 * Two variants are provided:
 *   - installSpeechMock         → exactly one ja-JP voice is available.
 *   - installNoJapaneseVoice    → only an en-US voice (no ja-JP).
 *
 * The function body of each init script is serialized and executed in the
 * browser context, so it must be self-contained (no closures over Node state).
 */

interface MockVoice {
  lang: string
  name: string
  default: boolean
  localService: boolean
  voiceURI: string
}

/**
 * Shared browser-side installer. Receives the list of voices to expose and
 * wires up a minimal-but-faithful `speechSynthesis` plus a stub
 * `SpeechSynthesisUtterance`. Defined as a string-free function so it stays
 * serializable for `addInitScript`.
 */
function speechMockInitScript(voices: MockVoice[]): void {
  // 'voiceschanged' listeners, supporting add/removeEventListener.
  const listeners = new Set<EventListenerOrEventListenerObject>()

  const synth = {
    pending: false,
    speaking: false,
    paused: false,
    getVoices(): MockVoice[] {
      return voices.slice()
    },
    speak(): void {
      // no-op: we never produce real audio in tests
    },
    cancel(): void {},
    pause(): void {},
    resume(): void {},
    onvoiceschanged: null as ((this: unknown, ev: Event) => unknown) | null,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      if (type === 'voiceschanged') listeners.add(listener)
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      if (type === 'voiceschanged') listeners.delete(listener)
    },
    dispatchEvent(event: Event): boolean {
      if (event.type === 'voiceschanged') {
        for (const l of listeners) {
          if (typeof l === 'function') l(event)
          else l.handleEvent(event)
        }
        if (typeof synth.onvoiceschanged === 'function') {
          synth.onvoiceschanged.call(synth, event)
        }
      }
      return true
    },
  }

  // Minimal SpeechSynthesisUtterance stub. Apps typically set .text, .lang,
  // .voice and attach onend/onerror handlers — none of which need to fire.
  class SpeechSynthesisUtteranceMock {
    text: string
    lang = ''
    voice: MockVoice | null = null
    volume = 1
    rate = 1
    pitch = 1
    onend: ((ev: Event) => unknown) | null = null
    onerror: ((ev: Event) => unknown) | null = null
    onstart: ((ev: Event) => unknown) | null = null
    constructor(text?: string) {
      this.text = text ?? ''
    }
    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean {
      return true
    }
  }

  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synth,
  })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: SpeechSynthesisUtteranceMock,
  })

  // Notify any listener that registers synchronously that voices are ready.
  // Done on a microtask so listeners attached during module init still catch it.
  Promise.resolve().then(() => {
    try {
      synth.dispatchEvent(new Event('voiceschanged'))
    } catch {
      /* Event may be unavailable in odd contexts; safe to ignore. */
    }
  })
}

const JA_VOICE: MockVoice = {
  lang: 'ja-JP',
  name: 'Test JA',
  default: true,
  localService: true,
  voiceURI: 'test-ja',
}

const EN_VOICE: MockVoice = {
  lang: 'en-US',
  name: 'Test EN',
  default: true,
  localService: true,
  voiceURI: 'test-en',
}

/**
 * Install a deterministic `speechSynthesis` exposing exactly ONE ja-JP voice.
 * Use this for the common case where Japanese audio is expected to be available.
 * Must be called before `page.goto(...)`.
 */
export async function installSpeechMock(page: Page): Promise<void> {
  await page.addInitScript(speechMockInitScript, [JA_VOICE])
}

/**
 * Install a deterministic `speechSynthesis` exposing only an en-US voice (no
 * ja-JP). Use this to assert that speaker buttons are hidden / disabled when no
 * Japanese voice exists. Must be called before `page.goto(...)`.
 */
export async function installNoJapaneseVoice(page: Page): Promise<void> {
  await page.addInitScript(speechMockInitScript, [EN_VOICE])
}
