/**
 * SpeakerButton — plays a reading aloud (F2).
 *
 * Reads from the shared SpeechController. When no Japanese (`ja-JP`) voice is
 * available, the button does NOT silently disappear — it renders DISABLED with a
 * tooltip + accessible label explaining why ("no silent failures", per spec). A
 * muted 🔇 icon signals the disabled state. Every press is a user gesture
 * (satisfying the iOS autoplay rule); a short "playing" pulse gives feedback.
 */
import { useState } from 'react'
import { useApp } from '../context/AppContext'

interface SpeakerButtonProps {
  reading: string
  /** Visual style: full-width pill (quiz) or small round (study rows). */
  variant?: 'full' | 'round'
  /** Visible label for the full pill variant. */
  label?: string
}

const UNAVAILABLE_TITLE =
  'Audio unavailable — this browser/device has no Japanese (ja-JP) voice installed.'

export default function SpeakerButton({
  reading,
  variant = 'full',
  label = 'Hear pronunciation',
}: SpeakerButtonProps) {
  const { speech, speechAvailable } = useApp()
  const [playing, setPlaying] = useState(false)

  const handle = () => {
    speech.speak(reading)
    setPlaying(true)
    // The controller doesn't surface utterance end, so pulse briefly.
    window.setTimeout(() => setPlaying(false), 900)
  }

  if (variant === 'round') {
    return (
      <button
        type="button"
        className={`sr-speak${playing ? ' playing' : ''}`}
        onClick={handle}
        disabled={!speechAvailable}
        title={speechAvailable ? `Hear ${reading}` : UNAVAILABLE_TITLE}
        aria-label={speechAvailable ? `Hear ${reading}` : `Audio unavailable for ${reading}`}
      >
        {speechAvailable ? '🔊' : '🔇'}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`sound-btn${playing ? ' playing' : ''}`}
      onClick={handle}
      disabled={!speechAvailable}
      title={speechAvailable ? undefined : UNAVAILABLE_TITLE}
      aria-label={speechAvailable ? label : `${label} — audio unavailable, no Japanese voice installed`}
    >
      {speechAvailable ? '🔊' : '🔇'} {speechAvailable ? label : 'Audio unavailable'}
    </button>
  )
}
