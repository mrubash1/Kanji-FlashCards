/**
 * Tests for the speech controller (spec F2).
 *
 * The real Web Speech API can't run in jsdom, so we build a small fake
 * `SpeechSynthesis` we can fully control: it lets each test decide what
 * `getVoices()` returns and lets us manually fire the `voiceschanged` event.
 * We also stub the global `SpeechSynthesisUtterance` class so we can inspect
 * the `lang` / `rate` / `voice` the controller sets on it.
 *
 * Timers are faked (`vi.useFakeTimers`) so the Safari-style polling is
 * deterministic — we advance virtual time instead of waiting for real seconds.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpeechController } from '../../src/lib/speech'

// --- Test doubles -----------------------------------------------------------

/** Minimal stand-in for a real `SpeechSynthesisVoice`. */
function makeVoice(lang: string, name = lang): SpeechSynthesisVoice {
  return {
    lang,
    name,
    default: false,
    localService: true,
    voiceURI: name,
  } as SpeechSynthesisVoice
}

const JA_VOICE = makeVoice('ja-JP', 'Kyoko')
const EN_VOICE = makeVoice('en-US', 'Samantha')

/**
 * A controllable fake `SpeechSynthesis`. `voices` can be swapped at any time to
 * simulate the async arrival of the voice list, and `fireVoicesChanged()`
 * dispatches the standard event to whatever listeners are registered.
 */
function makeFakeSynth() {
  let voices: SpeechSynthesisVoice[] = []
  const voicesChangedListeners = new Set<() => void>()

  const synth = {
    getVoices: vi.fn(() => voices),
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn((type: string, cb: () => void) => {
      if (type === 'voiceschanged') voicesChangedListeners.add(cb)
    }),
    removeEventListener: vi.fn((type: string, cb: () => void) => {
      if (type === 'voiceschanged') voicesChangedListeners.delete(cb)
    }),
  }

  return {
    // Cast through unknown: our fake only implements the slice we exercise.
    synth: synth as unknown as SpeechSynthesis,
    setVoices(next: SpeechSynthesisVoice[]) {
      voices = next
    },
    fireVoicesChanged() {
      for (const cb of voicesChangedListeners) cb()
    },
  }
}

/** Captures what the controller sets on each utterance it creates. */
class FakeUtterance {
  lang = ''
  rate = 1
  voice: SpeechSynthesisVoice | null = null
  constructor(public text: string) {}
}

beforeEach(() => {
  vi.useFakeTimers()
  // Stub the global constructor the controller calls with `new`.
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// --- Tests ------------------------------------------------------------------

describe('createSpeechController', () => {
  it('detects a ja-JP voice present at init and speaks with it', () => {
    const fake = makeFakeSynth()
    fake.setVoices([EN_VOICE, JA_VOICE])

    const controller = createSpeechController(fake.synth)
    expect(controller.isAvailable).toBe(true)

    controller.speak('みず')

    // cancel() must run before speak() to drop any in-flight utterance.
    const synthMock = fake.synth as unknown as {
      cancel: ReturnType<typeof vi.fn>
      speak: ReturnType<typeof vi.fn>
    }
    expect(synthMock.cancel).toHaveBeenCalledTimes(1)
    expect(synthMock.speak).toHaveBeenCalledTimes(1)

    const utterance = synthMock.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.text).toBe('みず')
    expect(utterance.lang).toBe('ja-JP')
    expect(utterance.rate).toBe(0.85)
    expect(utterance.voice).toBe(JA_VOICE)
  })

  it('is unavailable with no ja voice; speak is a no-op and cancel is safe', () => {
    const fake = makeFakeSynth()
    fake.setVoices([EN_VOICE])

    const controller = createSpeechController(fake.synth)
    expect(controller.isAvailable).toBe(false)

    controller.speak('みず')
    const synthMock = fake.synth as unknown as {
      speak: ReturnType<typeof vi.fn>
      cancel: ReturnType<typeof vi.fn>
    }
    expect(synthMock.speak).not.toHaveBeenCalled()

    // cancel() must not throw even when nothing is available / playing.
    expect(() => controller.cancel()).not.toThrow()
    expect(synthMock.cancel).toHaveBeenCalledTimes(1)
  })

  it('flips to available via voiceschanged and notifies subscribers once', () => {
    const fake = makeFakeSynth()
    fake.setVoices([]) // empty at first, like a real first paint

    const controller = createSpeechController(fake.synth)
    expect(controller.isAvailable).toBe(false)

    const onChange = vi.fn()
    const unsubscribe = controller.onAvailabilityChange(onChange)

    // Voices arrive, then the browser fires the standard event.
    fake.setVoices([JA_VOICE])
    fake.fireVoicesChanged()

    expect(controller.isAvailable).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)

    // A second event with no real change must not re-notify.
    fake.fireVoicesChanged()
    expect(onChange).toHaveBeenCalledTimes(1)

    // After unsubscribe, further changes are ignored.
    unsubscribe()
    fake.setVoices([])
    fake.fireVoicesChanged()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('becomes available via polling when voiceschanged never fires (Safari)', () => {
    const fake = makeFakeSynth()
    fake.setVoices([]) // Safari: empty, and the event will never come

    // Use a tiny custom schedule so the test is fast and explicit.
    const controller = createSpeechController(fake.synth, {
      pollDelays: [250, 500],
    })
    const onChange = vi.fn()
    controller.onAvailabilityChange(onChange)

    // First poll tick: voices still absent → stays unavailable.
    vi.advanceTimersByTime(250)
    expect(controller.isAvailable).toBe(false)
    expect(onChange).not.toHaveBeenCalled()

    // Voices appear, but no event fires. The next poll tick must catch it.
    fake.setVoices([JA_VOICE])
    vi.advanceTimersByTime(250) // now at 500ms — the second scheduled tick

    expect(controller.isAvailable).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('treats speak("") as a no-op even when a voice is available', () => {
    const fake = makeFakeSynth()
    fake.setVoices([JA_VOICE])

    const controller = createSpeechController(fake.synth)
    expect(controller.isAvailable).toBe(true)

    controller.speak('')
    const synthMock = fake.synth as unknown as {
      speak: ReturnType<typeof vi.fn>
      cancel: ReturnType<typeof vi.fn>
    }
    expect(synthMock.speak).not.toHaveBeenCalled()
    expect(synthMock.cancel).not.toHaveBeenCalled()
  })

  it('returns a safe no-op controller when speechSynthesis is undefined', () => {
    const controller = createSpeechController(undefined)

    expect(controller.isAvailable).toBe(false)
    expect(() => controller.speak('みず')).not.toThrow()
    expect(() => controller.cancel()).not.toThrow()

    // Subscribing is still safe and returns a usable unsubscribe function.
    const unsubscribe = controller.onAvailabilityChange(() => {})
    expect(() => unsubscribe()).not.toThrow()
  })
})
