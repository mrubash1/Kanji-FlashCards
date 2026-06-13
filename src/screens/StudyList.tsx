/**
 * StudyList — the reference list (the original's study-screen). One section per
 * topic in the current level, each row showing the kanji, meaning, reading +
 * romaji, and a speaker button. No quiz here — just browsing.
 */
import { useApp } from '../context/AppContext'
import AppHeader from '../components/AppHeader'
import SpeakerButton from '../components/SpeakerButton'
import { getCardsByLevel, TOPICS } from '../data/cards'

export default function StudyList() {
  const { level, navigate } = useApp()
  const cards = getCardsByLevel(level)
  const topics = TOPICS[level]

  return (
    <>
      <AppHeader title="Study list" onBack={() => navigate('topic')} backLabel="Back" />
      <main className="screen" id="study-screen">
        <p className="subtitle">
          Tap 🔊 to hear any word. Ready to practise? Head back and pick a topic.
        </p>

        {topics.map((topic) => {
          const topicCards = cards.filter((c) => topic.keys.includes(c.kanji))
          if (topicCards.length === 0) return null
          return (
            <section key={topic.name} className="study-section">
              <h3>
                {topic.name} · {topicCards.length} kanji
              </h3>
              {topicCards.map((card) => (
                <div key={card.id} className="study-row">
                  <div className="sr-kanji" lang="ja">
                    {card.kanji}
                  </div>
                  <div className="sr-info">
                    <div className="sr-english">{card.meaning}</div>
                    <div className="sr-reading" lang="ja">
                      {card.reading} <span className="sr-romaji">{card.romaji}</span>
                    </div>
                  </div>
                  <SpeakerButton reading={card.reading} variant="round" />
                </div>
              ))}
            </section>
          )
        })}
      </main>
    </>
  )
}
