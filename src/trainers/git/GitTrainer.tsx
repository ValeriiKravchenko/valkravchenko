// ============================================================
// Git trainer, section 1: screen. State lives in the engine (engine/): this
// file only shows SectionState and passes the player's actions to
// runCommand/editFile/deleteFile/createFile/resetSection. No git behaviour
// is decided here. Markup and classes follow the sky-os design tokens.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useDictionary } from '../../i18n'
import { TerminalInput, TerminalLog, TerminalPanel } from '../ui/TerminalPanel'
import { TrainerButton } from '../ui/TrainerButton'
import { TrainerPanel } from '../ui/TrainerPanel'
import { TrainerWindow } from '../ui/TrainerWindow'
import type { HistoryEntry, MissionView, SectionState } from './engine'
import { Stage, createFile, createSection, deleteFile, editFile, getHeadTree, getMissions, getStage, getStatus, repoHasNoFiles, resetSection, runCommand } from './engine'
import { ru } from './locales/ru'

function isCommandEntry(h: HistoryEntry): h is Extract<HistoryEntry, { kind: 'command' }> {
  return h.kind === 'command'
}

const groupLabelClass = 'm-0 mb-1 font-mono text-[13px] text-muted'

// ---------- Terminal ----------

function Terminal({ state, onRun }: { state: SectionState; onRun: (input: string) => void }) {
  const t = useDictionary()
  const [draft, setDraft] = useState('')
  // Text typed before entering the ↑/↓ history: ↓ after the last command brings it back.
  const [pendingDraft, setPendingDraft] = useState<string | null>(null)
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const commandHistory = state.history.filter(isCommandEntry)

  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.history.length])

  function submit() {
    if (!draft.trim()) return
    onRun(draft)
    setDraft('')
    setHistoryIndex(null)
    setPendingDraft(null)
  }

  function navigateHistory(direction: -1 | 1) {
    if (!commandHistory.length) return
    if (historyIndex === null) {
      if (direction === 1) return
      setPendingDraft(draft)
      setHistoryIndex(commandHistory.length - 1)
      setDraft(commandHistory[commandHistory.length - 1].input)
      return
    }
    const next = historyIndex + direction
    if (next < 0) return
    if (next >= commandHistory.length) {
      setHistoryIndex(null)
      setDraft(pendingDraft ?? '')
      setPendingDraft(null)
      return
    }
    setHistoryIndex(next)
    setDraft(commandHistory[next].input)
  }

  const prompt = ru.ui.terminal.prompt(state.branch)

  return (
    <TerminalPanel
      title={ru.ui.terminal.title}
      className="h-[420px] md:h-[520px]"
      footer={
        <TerminalInput
          label={ru.ui.terminal.inputAriaLabel}
          prompt={prompt}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            else if (e.key === 'ArrowUp') {
              e.preventDefault()
              navigateHistory(-1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              navigateHistory(1)
            }
          }}
          placeholder={ru.ui.terminal.placeholder}
        />
      }
    >
      <TerminalLog ref={outputRef} label={ru.ui.terminal.title} className="space-y-3">
        {state.history.length === 0 && <p className="m-0 text-term-dim"># {ru.ui.terminal.emptyHistory}</p>}
        {state.history.map((entry, i) =>
          isCommandEntry(entry) ? (
            <div key={i}>
              <p className="m-0">
                <span className="text-term-prompt">{prompt}</span> {entry.input}
              </p>
              {entry.output && (
                <pre
                  className={`m-0 font-[inherit] whitespace-pre-wrap [overflow-wrap:anywhere] ${
                    entry.ok ? '' : 'border-l-2 border-term-dim pl-3'
                  }`}
                >
                  {!entry.ok && <span className="sr-only">{t.trainers.failedOutput} </span>}
                  {entry.output}
                </pre>
              )}
              {entry.explanation && <p className="m-0 mt-1 text-term-prompt">💡 {entry.explanation}</p>}
            </div>
          ) : (
            <p key={i} className="m-0 text-term-dim"># {entry.text}</p>
          ),
        )}
      </TerminalLog>
    </TerminalPanel>
  )
}

// ---------- Working tree status ----------

function StatusBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex rounded-chip border border-chip-line bg-chip px-1.5 font-mono text-[13px] text-muted">
      {text}
    </span>
  )
}

function StatusPanel({ state }: { state: SectionState }) {
  const stage = getStage(state)
  const status = getStatus(state)
  const noFiles = repoHasNoFiles(state)

  return (
    <TrainerPanel title={ru.ui.status.title} bodyClassName="space-y-3 px-4 py-3">
      <p className="m-0 text-muted">{ru.ui.status.branchLabel(status.branch)}</p>
      {stage === Stage.NoRepo && <p className="m-0">{ru.explain.notAGitRepo}</p>}
      {stage !== Stage.NoRepo && noFiles && <p className="m-0 text-muted">{ru.ui.status.empty}</p>}
      {stage !== Stage.NoRepo && !noFiles && (
        <>
          {status.staged.length > 0 && (
            <div>
              <p className={groupLabelClass}>{ru.ui.status.stagedGroup}</p>
              <ul className="m-0 list-none space-y-1 p-0">
                {status.staged.map((f) => (
                  <li key={f.file} className="flex flex-wrap items-center gap-2">
                    <StatusBadge text={f.type} />
                    <span className="[overflow-wrap:anywhere]">{f.file}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status.notStaged.length > 0 && (
            <div>
              <p className={groupLabelClass}>{ru.ui.status.notStagedGroup}</p>
              <ul className="m-0 list-none space-y-1 p-0">
                {status.notStaged.map((f) => (
                  <li key={f.file} className="flex flex-wrap items-center gap-2">
                    <StatusBadge text={f.type} />
                    <span className="[overflow-wrap:anywhere]">{f.file}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status.untracked.length > 0 && (
            <div>
              <p className={groupLabelClass}>{ru.ui.status.untrackedGroup}</p>
              <ul className="m-0 list-none space-y-1 p-0">
                {status.untracked.map((f) => (
                  <li key={f} className="flex flex-wrap items-center gap-2">
                    <StatusBadge text={ru.ui.status.untrackedBadge} />
                    <span className="[overflow-wrap:anywhere]">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stage === Stage.Clean && <p className="m-0 text-muted">{ru.ui.status.clean}</p>}
        </>
      )}
    </TrainerPanel>
  )
}

// ---------- Three areas of Git ----------

function AreaColumn({
  label,
  files,
  empty,
  note,
}: {
  label: string
  files: string[]
  empty: string
  note: (file: string) => string | null
}) {
  return (
    <div className="px-4 py-3">
      <p className={`${groupLabelClass} mb-2`}>{label}</p>
      {files.length === 0 ? (
        <p className="m-0 text-muted">{empty}</p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {files.map((f) => {
            const n = note(f)
            return (
              <li key={f}>
                <p className="m-0 [overflow-wrap:anywhere]">{f}</p>
                {n && <p className="m-0 text-[14px] text-muted">{n}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function AreasDiagram({ state }: { state: SectionState }) {
  const status = getStatus(state)
  const headTree = getHeadTree(state)
  const workingFiles = Object.keys(state.working).sort()
  const indexFiles = Object.keys(state.index).sort()
  const headFiles = Object.keys(headTree).sort()

  const untrackedSet = new Set(status.untracked)
  const modifiedNotStagedSet = new Set(status.notStaged.filter((e) => e.type === 'modified').map((e) => e.file))
  const stagedTypeByFile = new Map(status.staged.map((e) => [e.file, e.type]))

  return (
    <TrainerPanel title={ru.ui.areas.title} bodyClassName="p-0">
      <div className="grid grid-cols-1 divide-y divide-divider md:grid-cols-3 md:divide-x md:divide-y-0">
        <AreaColumn
          label={ru.ui.areas.workingLabel}
          files={workingFiles}
          empty={ru.ui.areas.empty}
          note={(f) => (untrackedSet.has(f) ? ru.ui.areas.newUntracked : modifiedNotStagedSet.has(f) ? ru.ui.areas.modifiedAfterAdd : null)}
        />
        <AreaColumn
          label={ru.ui.areas.indexLabel}
          files={indexFiles}
          empty={ru.ui.areas.empty}
          note={(f) => {
            const type = stagedTypeByFile.get(f)
            return type === 'new file' ? ru.ui.areas.willCommitNew : type === 'modified' ? ru.ui.areas.willCommitModified : null
          }}
        />
        <AreaColumn
          label={ru.ui.areas.headLabel}
          files={headFiles}
          empty={state.commits.length === 0 ? ru.ui.areas.noCommits : ru.ui.areas.empty}
          note={() => null}
        />
      </div>
      <div className="flex justify-between gap-4 border-t border-divider px-4 py-2 font-mono text-[13px] text-muted">
        <span>{ru.ui.areas.addArrow}</span>
        <span>{ru.ui.areas.commitArrow}</span>
      </div>
      <p className="m-0 border-t border-divider px-4 py-3 text-muted">{ru.ui.areas.caption(state.commits.length)}</p>
    </TrainerPanel>
  )
}

// ---------- Commit graph ----------

function CommitGraph({ state }: { state: SectionState }) {
  const commits = state.commits.slice().reverse()
  return (
    <TrainerPanel title={ru.ui.commitGraph.title}>
      {commits.length === 0 ? (
        <p className="m-0 text-muted">{ru.ui.commitGraph.empty}</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {commits.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-accent">{c.id}</span>
              <span className="[overflow-wrap:anywhere]">{c.message}</span>
              {i === 0 && state.branch && (
                <span className="font-mono text-[13px] text-muted">{ru.ui.commitGraph.headArrow(state.branch)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </TrainerPanel>
  )
}

// ---------- Files in the working tree ----------

function FilesPanel({
  state,
  onEdit,
  onDelete,
  onCreate,
}: {
  state: SectionState
  onEdit: (file: string) => void
  onDelete: (file: string) => void
  onCreate: (name: string) => void
}) {
  const [newName, setNewName] = useState('')
  const files = Object.keys(state.working).sort()

  function submitCreate() {
    onCreate(newName)
    setNewName('')
  }

  return (
    <TrainerPanel title={ru.ui.files.title} bodyClassName="space-y-4 px-4 py-3">
      {files.length === 0 ? (
        <p className="m-0 text-muted">{ru.ui.files.empty}</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {files.map((f) => (
            <li key={f} className="rounded-button border border-divider p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="[overflow-wrap:anywhere]">{f}</span>
                <div className="flex flex-wrap gap-2">
                  <TrainerButton onClick={() => onEdit(f)} aria-label={`${ru.ui.files.editButton}: ${f}`}>
                    {ru.ui.files.editButton}
                  </TrainerButton>
                  <TrainerButton onClick={() => onDelete(f)} aria-label={`${ru.ui.files.deleteButton}: ${f}`}>
                    {ru.ui.files.deleteButton}
                  </TrainerButton>
                </div>
              </div>
              <pre className="m-0 mt-2 font-mono text-[13px] whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">
                {state.working[f]}
              </pre>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitCreate()
          }}
          placeholder={ru.ui.files.newFileNamePlaceholder}
          aria-label={ru.ui.files.newFileNamePlaceholder}
          spellCheck={false}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-button border border-tile-line bg-tile px-3 font-mono text-[16px] text-ink placeholder:text-muted sm:text-[14px]"
        />
        <TrainerButton onClick={submitCreate}>{ru.ui.files.createButton}</TrainerButton>
      </div>
    </TrainerPanel>
  )
}

// ---------- Missions ----------

function MissionsPanel({ missions }: { missions: MissionView[] }) {
  const t = useDictionary()
  return (
    <TrainerPanel title={ru.ui.missions.title}>
      <ul className="m-0 list-none space-y-3 p-0">
        {missions.map((m) => (
          <li key={m.id} data-done={m.done} className={`flex items-start gap-3 ${m.done ? 'text-muted' : ''}`}>
            <span aria-hidden="true" className="font-mono text-accent">
              {m.done ? '✓' : '—'}
            </span>
            <span className={m.done ? 'line-through' : ''}>
              <span className="sr-only">{m.done ? t.trainers.missionDone : t.trainers.missionTodo} </span>
              {m.text}
              <span className="mt-1 block font-mono text-[13px] text-muted">{m.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </TrainerPanel>
  )
}

// ---------- The whole trainer ----------

export default function GitTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<SectionState>(createSection)

  function handleRun(input: string) {
    const { state: next, result } = runCommand(state, input)
    if (result === null) return
    setState(next)
  }
  function handleEdit(file: string) {
    setState(editFile(state, file))
  }
  function handleDelete(file: string) {
    setState(deleteFile(state, file))
  }
  function handleCreate(name: string) {
    setState(createFile(state, name))
  }
  function handleReset() {
    setState(resetSection())
  }

  const missions = getMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.git.windowTitle}
      heading={ru.ui.heading}
      subheading={ru.ui.subheading}
      intro={ru.ui.intro}
      actions={<TrainerButton onClick={handleReset}>{ru.ui.resetButton}</TrainerButton>}
    >
      {/* On a phone the terminal comes before the panels (a deliberate choice of the source trainer):
          with grid-cols-1 the columns stack in DOM order. */}
      <div className="grid gap-6 md:grid-cols-2">
        <Terminal state={state} onRun={handleRun} />
        <div className="min-w-0 space-y-6">
          <StatusPanel state={state} />
          <CommitGraph state={state} />
          <FilesPanel state={state} onEdit={handleEdit} onDelete={handleDelete} onCreate={handleCreate} />
        </div>
      </div>

      <AreasDiagram state={state} />
      <MissionsPanel missions={missions} />
    </TrainerWindow>
  )
}
