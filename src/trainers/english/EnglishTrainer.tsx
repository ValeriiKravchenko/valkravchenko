// ============================================================
// English words trainer: screen. Session and progress state live here (in the
// component), not in the engine (engine/): the engine only takes it as a
// parameter and returns the recalculated value. Leitner rules, repeat dates
// and so on are decided by engine/ alone. Markup and classes follow the
// sky-os design tokens.
// ============================================================
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  answerCurrent,
  createSession,
  currentWord,
  getStats,
  isSessionFinished,
  parseProgress,
  serializeProgress,
} from './engine'
import type { ParseProgressError, ProgressStore, SessionState } from './engine'
import { getLocalToday, shuffleArray } from './browserEnv'
import { brokenProgressExport, loadInitialProgress, writeStoredProgress } from './progressStorage'
import { loadInitialSession, writeStoredSession } from './sessionStorage'
import { englishWordIds, getWordById } from './words'
import { ru } from './locales/ru'
import { useDictionary } from '../../i18n'
import { TrainerButton } from '../ui/TrainerButton'
import { TrainerPanel } from '../ui/TrainerPanel'
import { TrainerWindow } from '../ui/TrainerWindow'

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

function speak(word: string) {
  if (!speechSupported) return
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  // cancel what is still being spoken: otherwise repeated clicks queue phrases
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const labelClass = 'm-0 mb-1 font-mono text-[13px] text-muted'

// ---------- Word card ----------

function WordCard({
  wordId,
  revealed,
  onReveal,
  onAnswer,
}: {
  wordId: string
  revealed: boolean
  onReveal: () => void
  onAnswer: (answer: 'know' | 'dontKnow') => void
}) {
  const word = getWordById(wordId)
  const titleId = useId()
  if (!word) return null // should not happen: session ids always come from englishWordIds

  return (
    <section
      aria-labelledby={titleId}
      className="min-w-0 overflow-hidden rounded-button border border-border bg-window"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-divider px-4 py-4">
        <h2 id={titleId} className="m-0 text-2xl font-semibold [overflow-wrap:anywhere]">
          {word.word}
        </h2>
        {speechSupported && (
          <TrainerButton onClick={() => speak(word.word)} aria-label={ru.ui.card.listenAriaLabel}>
            {ru.ui.card.listenButton}
          </TrainerButton>
        )}
      </div>

      {!revealed ? (
        <div className="px-4 py-6">
          <TrainerButton variant="primary" onClick={onReveal}>
            {ru.ui.card.revealButton}
            <span className="font-mono text-[13px] font-normal">[{ru.ui.card.revealHint}]</span>
          </TrainerButton>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div>
            <p className={labelClass}>{ru.ui.card.translationLabel}</p>
            <p className="m-0">{word.translation}</p>
          </div>
          <div>
            <p className={labelClass}>{ru.ui.card.exampleLabel}</p>
            <p className="m-0 text-muted">{word.example}</p>
          </div>
          {word.note && (
            <div>
              <p className={labelClass}>{ru.ui.card.noteLabel}</p>
              <p className="m-0 text-muted">{word.note}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <TrainerButton onClick={() => onAnswer('dontKnow')}>
              {ru.ui.card.dontKnowButton}
              <span className="font-mono text-[13px] font-normal">[{ru.ui.card.dontKnowHint}]</span>
            </TrainerButton>
            <TrainerButton variant="primary" onClick={() => onAnswer('know')}>
              {ru.ui.card.knowButton}
              <span className="font-mono text-[13px] font-normal">[{ru.ui.card.knowHint}]</span>
            </TrainerButton>
          </div>
        </div>
      )}
    </section>
  )
}

// ---------- Statistics ----------

function StatCell({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col-reverse px-3 py-3">
      <dt className="m-0 mt-1 text-[14px] text-muted [overflow-wrap:anywhere]">{label}</dt>
      <dd className={`m-0 text-xl font-semibold ${accent ? 'text-accent' : ''}`}>{value}</dd>
    </div>
  )
}

function StatsPanel({ progress, today }: { progress: ProgressStore; today: string }) {
  const stats = getStats(progress, englishWordIds, today)
  return (
    <TrainerPanel title={ru.ui.stats.title} bodyClassName="p-0">
      <dl className="m-0 grid grid-cols-3 divide-x divide-divider border-b border-divider">
        <StatCell value={stats.newCount} label={ru.ui.stats.newCount} />
        <StatCell value={stats.learning} label={ru.ui.stats.learning} />
        <StatCell value={stats.learned} label={ru.ui.stats.learned} />
      </dl>
      <dl className="m-0">
        <StatCell value={stats.dueToday} label={ru.ui.stats.dueToday} accent />
      </dl>
      <p className="m-0 px-4 pb-3 text-[14px] text-muted">{ru.ui.stats.dueTodayNote}</p>
    </TrainerPanel>
  )
}

// ---------- Progress: export / import ----------

function ProgressPanel({
  progress,
  onImported,
}: {
  progress: ProgressStore
  onImported: (store: ProgressStore) => void
}) {
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    downloadJson(`english-progress-${getLocalToday()}.json`, serializeProgress(progress))
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so that choosing the same file again fires the event again
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = parseProgress(text)
      if (!result.ok) {
        setMessage(ru.ui.progress.importError(ru.parseErrorText[result.error]))
        return
      }
      if (!window.confirm(ru.ui.progress.importConfirm)) return
      onImported(result.store)
      setMessage(ru.ui.progress.importSuccess)
    }
    reader.readAsText(file)
  }

  return (
    <TrainerPanel title={ru.ui.progress.title} bodyClassName="p-0">
      <div className="flex flex-wrap gap-3 px-4 py-3">
        <TrainerButton onClick={handleExport}>{ru.ui.progress.exportButton}</TrainerButton>
        <TrainerButton onClick={handleImportClick}>{ru.ui.progress.importButton}</TrainerButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          className="hidden"
          aria-label={ru.ui.progress.importButton}
          tabIndex={-1}
        />
      </div>
      {message && (
        <output className="m-0 block border-t border-divider px-4 py-3 text-muted">
          {message}
        </output>
      )}
    </TrainerPanel>
  )
}

// ---------- The whole trainer ----------

export default function EnglishTrainer() {
  const t = useDictionary()
  const [initial] = useState(() => {
    const loaded = loadInitialProgress()
    // Today's session is restored as is when saved for today (see sessionStorage.ts):
    // otherwise createSession would rebuild it and bypass the daily limit of new words
    // on every page reload.
    const session = loadInitialSession(loaded.store, englishWordIds, getLocalToday(), shuffleArray)
    return { progress: loaded.store, loadError: loaded.error, brokenRaw: loaded.brokenRaw, session }
  })
  const [progress, setProgress] = useState<ProgressStore>(() => initial.progress)
  const [session, setSession] = useState<SessionState>(() => initial.session)
  const [loadError, setLoadError] = useState<ParseProgressError | null>(() => initial.loadError)
  // raw broken progress string, only for the "download broken data" button;
  // already copied to BROKEN_PROGRESS_STORAGE_KEY in loadInitialProgress
  const [brokenRaw] = useState<string | null>(() => initial.brokenRaw)
  // id of the word whose translation is shown. A mismatch with the current wordId
  // means the new card is not revealed yet (no extra effect on wordId change).
  const [revealedWordId, setRevealedWordId] = useState<string | null>(null)

  const wordId = currentWord(session)
  const finished = isSessionFinished(session)
  const revealed = revealedWordId !== null && revealedWordId === wordId

  function handleAnswer(answer: 'know' | 'dontKnow') {
    const today = getLocalToday()
    const result = answerCurrent(session, progress, answer, today)
    setSession(result.session)
    setProgress(result.progress)
    writeStoredProgress(serializeProgress(result.progress))
    writeStoredSession(today, result.session)
    // from now on the storage holds real progress, not an empty one: the broken-file
    // message, if any, no longer describes what is actually saved
    setLoadError(null)
  }

  function handleImported(store: ProgressStore) {
    const today = getLocalToday()
    const newSession = createSession(store, englishWordIds, today, shuffleArray)
    setProgress(store)
    writeStoredProgress(serializeProgress(store))
    setSession(newSession)
    writeStoredSession(today, newSession)
    setLoadError(null)
  }

  function handleReveal() {
    if (wordId) setRevealedWordId(wordId)
  }

  function handleDownloadBroken() {
    if (!brokenRaw) return
    const { filename, content } = brokenProgressExport(brokenRaw, getLocalToday())
    downloadJson(filename, content)
  }

  // Hotkeys: space reveals the translation, 1 is "don't know", 2 is "know".
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (finished) return
      if (!revealed) {
        if (e.code === 'Space') {
          e.preventDefault()
          handleReveal()
        }
        return
      }
      if (e.key === '1') handleAnswer('dontKnow')
      else if (e.key === '2') handleAnswer('know')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <TrainerWindow
      windowTitle={t.trainers.english.windowTitle}
      heading={ru.ui.heading}
      subheading={ru.ui.subheading}
      intro={ru.ui.intro}
    >
      {loadError && (
        <div role="alert" className="rounded-button border border-teal bg-chip px-4 py-3">
          <p className="m-0">{ru.ui.progress.loadError(ru.parseErrorText[loadError])}</p>
          {brokenRaw && (
            <TrainerButton onClick={handleDownloadBroken} className="mt-3">
              {ru.ui.progress.downloadBrokenButton}
            </TrainerButton>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {!finished && <p className="m-0 font-mono text-[15px] text-muted">{ru.ui.wordsLeft(session.queue.length)}</p>}
          {finished ? (
            <section className="rounded-button border border-border bg-window px-4 py-8 text-center">
              <h2 className="m-0 text-xl font-semibold">{ru.ui.finished.heading}</h2>
              <p className="m-0 mt-3 text-muted">{ru.ui.finished.text}</p>
            </section>
          ) : (
            wordId && <WordCard wordId={wordId} revealed={revealed} onReveal={handleReveal} onAnswer={handleAnswer} />
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <StatsPanel progress={progress} today={getLocalToday()} />
          <ProgressPanel progress={progress} onImported={handleImported} />
        </div>
      </div>
    </TrainerWindow>
  )
}
