/**
 * QuizInput — the answer field for the quiz.
 *
 * When `kana` is true (the reading step, F3) it binds the `wanakana` library to
 * the DOM input so romaji is converted to kana *as the learner types* ("mizu"
 * becomes みず live). wanakana drives the input's value directly, so this is an
 * UNCONTROLLED input: the parent reads the value imperatively via the ref rather
 * than through React state (a controlled value would fight wanakana on each
 * keystroke). The meaning step uses the same component with `kana={false}` for a
 * plain text field, so both steps share one accessible input.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { bind, unbind } from 'wanakana'

export interface QuizInputHandle {
  /** Current text in the field. */
  getValue: () => string
  /** Clear and re-enable the field. */
  clear: () => void
  /** Move focus into the field. */
  focus: () => void
}

interface QuizInputProps {
  id: string
  placeholder: string
  /** Bind wanakana (romaji → kana) when true. */
  kana: boolean
  disabled?: boolean
  /** Accessible label describing what to type. */
  ariaLabel: string
  /** Called when Enter is pressed in the field. */
  onEnter: () => void
}

const QuizInput = forwardRef<QuizInputHandle, QuizInputProps>(function QuizInput(
  { id, placeholder, kana, disabled, ariaLabel, onEnter },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Expose a tiny imperative API to the parent (read value, clear, focus).
  useImperativeHandle(ref, () => ({
    getValue: () => inputRef.current?.value ?? '',
    clear: () => {
      if (inputRef.current) inputRef.current.value = ''
    },
    focus: () => inputRef.current?.focus(),
  }))

  // Bind/unbind wanakana to the live DOM node when in kana mode.
  useEffect(() => {
    const el = inputRef.current
    if (!el || !kana) return
    bind(el, { IMEMode: 'toHiragana' })
    return () => unbind(el)
  }, [kana])

  return (
    <input
      ref={inputRef}
      id={id}
      className="quiz-input"
      type="text"
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          onEnter()
        }
      }}
    />
  )
})

export default QuizInput
