/**
 * App — the screen router.
 *
 * Mirrors the original `showScreen(id)` model: exactly one screen is shown,
 * chosen by the typed `screen` value in context. There is deliberately no
 * routing library — the union in `types.ts` IS the router, which keeps the diff
 * from the original teachable. The Toast lives here so it floats above any
 * screen.
 */
import { useEffect, useRef } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import type { Screen } from './types'
import Toast from './components/Toast'
import Onboarding from './screens/Onboarding'
import LevelPicker from './screens/LevelPicker'
import TopicPicker from './screens/TopicPicker'
import StudyList from './screens/StudyList'
import Quiz from './screens/Quiz'
import Results from './screens/Results'
import DeckList from './screens/DeckList'
import DeckEditor from './screens/DeckEditor'
import './styles/components.css'

function CurrentScreen({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'onboarding':
      return <Onboarding />
    case 'level':
      return <LevelPicker />
    case 'topic':
      return <TopicPicker />
    case 'study':
      return <StudyList />
    case 'quiz':
      return <Quiz />
    case 'results':
      return <Results />
    case 'deckList':
      return <DeckList />
    case 'deckEditor':
      return <DeckEditor />
  }
}

function Shell() {
  const { screen, toast } = useApp()
  const appRef = useRef<HTMLDivElement>(null)

  // On each screen change, move keyboard focus to the new screen's first
  // heading (F8) so screen-reader and keyboard users aren't stranded on a
  // control that no longer exists. The heading is made focusable just-in-time.
  useEffect(() => {
    const heading = appRef.current?.querySelector<HTMLElement>('h1, h2')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    }
  }, [screen])

  return (
    <div className="app" ref={appRef}>
      <CurrentScreen screen={screen} />
      <Toast message={toast} />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
