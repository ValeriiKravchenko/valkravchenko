// ============================================================
// Git trainer, section 7 (effective work): screen. State lives in the engine
// (engine/practicesSection.ts): this file only shows PracticesState and passes the
// player's input to it. No git behaviour is decided here. Markup and classes follow
// the sky-os design tokens and the screen of section 6.
//
// Parts: terminal, `.gitignore` editor, list of files (no marks: the answer about what
// is ignored comes from git in the terminal), the trainer's advice on a commit message,
// missions. The advice widget is the trainer's speech, not git output (target.md,
// part IX, dangerous place 11); it is computed by computeCommitAdvice.
// ============================================================
import { useState } from 'react'
import { useDictionary } from '../../i18n'
import { TerminalHistory } from '../ui/TerminalHistory'
import { TerminalInput, TerminalLog, TerminalPanel } from '../ui/TerminalPanel'
import { TrainerButton } from '../ui/TrainerButton'
import { TrainerMissions } from '../ui/TrainerMissions'
import { TrainerPanel } from '../ui/TrainerPanel'
import { TrainerWindow } from '../ui/TrainerWindow'
import { useCommandHistory } from '../ui/useCommandHistory'
import {
  computeCommitAdvice,
  createPracticesSection,
  getGitignoreText,
  getPracticesMissions,
  getWorkingFiles,
  resetPracticesSection,
  runPracticesCommand,
  writeGitignore,
} from './engine/practicesSection'
import type { AdviceKind, PracticesState } from './engine/practicesSection'
import { ru } from './locales/ru'

const ui = ru.practices.ui

const fieldClass =
  'block w-full min-w-0 rounded-button border border-tile-line bg-tile p-3 font-mono text-[16px] text-ink placeholder:text-muted sm:text-[14px]'

// ---------- Terminal ----------

function Terminal({ state, onRun }: { state: PracticesState; onRun: (input: string) => void }) {
  const { draft, setDraft, outputRef, onKeyDown } = useCommandHistory(state.history, onRun)

  const prompt = ui.terminal.prompt(state.branch)

  return (
    <TerminalPanel
      title={ui.terminal.title}
      className="h-[420px] md:h-[520px]"
      footer={
        <TerminalInput
          label={ui.terminal.inputAriaLabel}
          prompt={prompt}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={ui.terminal.placeholder}
        />
      }
    >
      <TerminalLog ref={outputRef} label={ui.terminal.title} className="space-y-3">
        <TerminalHistory entries={state.history} prompt={prompt} emptyText={ui.terminal.emptyHistory} />
      </TerminalLog>
    </TerminalPanel>
  )
}

// ---------- .gitignore editor ----------
//
// A plain text field for the file `.gitignore` of the working directory. Any text is allowed.
// The unsaved text is the screen's own state; "Save" passes it to the engine, which applies the
// rules at once and writes the note about it into the history.

function GitignoreEditor({
  text,
  onChange,
  onSave,
}: {
  text: string
  onChange: (text: string) => void
  onSave: () => void
}) {
  return (
    <TrainerPanel title={ui.gitignoreEditor.title}>
      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ui.gitignoreEditor.ariaLabel}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          rows={6}
          className={`${fieldClass} min-h-32 resize-y`}
        />
        <TrainerButton onClick={onSave}>{ui.gitignoreEditor.saveButton}</TrainerButton>
      </div>
    </TrainerPanel>
  )
}

// ---------- Files of the working directory ----------
//
// Only the list: no marks "ignored / tracked", no edit, create or delete (target.md, part IX).

function FilesPanel({ state }: { state: PracticesState }) {
  const files = getWorkingFiles(state)

  return (
    <TrainerPanel title={ui.files.title}>
      <ul className="m-0 list-none space-y-2 p-0">
        {files.map((f) => (
          <li key={f} className="rounded-button border border-divider px-3 py-2 font-mono text-[13px] [overflow-wrap:anywhere]">
            {f}
          </li>
        ))}
      </ul>
    </TrainerPanel>
  )
}

// ---------- The trainer's advice on a commit message ----------
//
// Not git output: the title says so and the marks are plain text with a hidden word for screen
// readers. The advice itself comes from computeCommitAdvice.

const markOf: Record<AdviceKind, string> = { warn: '⚠', info: 'ℹ', ok: '✓' }
const wordOf: Record<AdviceKind, string> = {
  warn: ui.advice.warnWord,
  info: ui.advice.infoWord,
  ok: ui.advice.okWord,
}

function AdvicePanel({ message, onChange }: { message: string; onChange: (message: string) => void }) {
  const advice = computeCommitAdvice(message)

  return (
    <TrainerPanel title={ui.advice.title}>
      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ui.advice.inputAriaLabel}
          placeholder={ui.advice.placeholder}
          spellCheck={false}
          rows={4}
          className={`${fieldClass} min-h-24 resize-y`}
        />
        <div className="flex flex-wrap gap-2">
          <TrainerButton onClick={() => onChange(ru.practices.advice.examples.body)}>{ui.advice.bodyButton}</TrainerButton>
          <TrainerButton onClick={() => onChange(ru.practices.advice.examples.bad)}>{ui.advice.badButton}</TrainerButton>
          <TrainerButton onClick={() => onChange(ru.practices.advice.examples.good)}>{ui.advice.goodButton}</TrainerButton>
        </div>
        <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0 text-[15px]">
          <legend className="sr-only">{ui.advice.reportLabel}</legend>
          {advice.empty ? (
            <p className="m-0 text-muted">{advice.hint}</p>
          ) : (
            <>
              <p className="m-0 font-semibold">{advice.counter}</p>
              <ul className="m-0 list-none space-y-2 p-0">
                {advice.items.map((item) => (
                  <li key={`${item.kind}-${item.text}`} data-kind={item.kind} className="flex items-start gap-2">
                    <span aria-hidden="true" className="shrink-0">
                      {markOf[item.kind]}
                    </span>
                    <span className={item.kind === 'warn' ? 'font-semibold' : ''}>
                      <span className="sr-only">{wordOf[item.kind]} </span>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="m-0 text-[14px] text-muted">{ui.advice.footnote}</p>
        </fieldset>
      </div>
    </TrainerPanel>
  )
}

// ---------- The whole trainer ----------

export default function PracticesTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<PracticesState>(createPracticesSection)
  // Unsaved texts of the two fields: local to the screen, cleared by "start over".
  const [gitignoreText, setGitignoreText] = useState(() => getGitignoreText(state))
  const [message, setMessage] = useState('')

  function handleRun(input: string) {
    const { state: next, result } = runPracticesCommand(state, input)
    if (result === null) return
    setState(next)
  }
  function handleSave() {
    setState(writeGitignore(state, gitignoreText))
  }
  function handleReset() {
    const fresh = resetPracticesSection()
    setState(fresh)
    setGitignoreText(getGitignoreText(fresh))
    setMessage('')
  }

  const missions = getPracticesMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.gitPractices.windowTitle}
      heading={ui.heading}
      subheading={ui.subheading}
      intro={ui.intro}
      actions={<TrainerButton onClick={handleReset}>{ui.resetButton}</TrainerButton>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Terminal state={state} onRun={handleRun} />
        <div className="min-w-0 space-y-6">
          <GitignoreEditor text={gitignoreText} onChange={setGitignoreText} onSave={handleSave} />
          <FilesPanel state={state} />
        </div>
      </div>

      <AdvicePanel message={message} onChange={setMessage} />

      <TrainerMissions title={ui.missions.title} missions={missions} />
    </TrainerWindow>
  )
}
