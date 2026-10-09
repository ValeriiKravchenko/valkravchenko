// ============================================================
// Git trainer, section 3 (inspecting): screen. State lives in the engine
// (engine/inspectSection.ts): this file only shows InspectState and passes the
// player's actions to runInspectCommand/editFile/deleteFile/createFile. No git
// behaviour is decided here. Markup and classes follow the sky-os design tokens.
//
// Unlike section 2 there is no commit graph: the history of this section is linear
// (one branch, no merge commits) and `git log` in the terminal already shows it, so
// a second drawing of the same list would only duplicate the command.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useDictionary } from '../../i18n'
import { FileAreasPanel } from '../ui/FileAreas'
import { TerminalHistory } from '../ui/TerminalHistory'
import { TerminalInput, TerminalLog, TerminalPanel } from '../ui/TerminalPanel'
import { TrainerButton } from '../ui/TrainerButton'
import { TrainerMissions } from '../ui/TrainerMissions'
import { TrainerPanel } from '../ui/TrainerPanel'
import { TrainerWindow } from '../ui/TrainerWindow'
import {
  createFile,
  createInspectSection,
  deleteFile,
  editFile,
  getHeadTree,
  getInspectMissions,
  runInspectCommand,
} from './engine/inspectSection'
import type { FileTree, HistoryEntry, InspectState } from './engine/inspectSection'
import { ru } from './locales/ru'

const ri = ru.inspecting
const ui = ri.ui

function createInitialState(): InspectState {
  return createInspectSection(ri.seed)
}

function isCommandEntry(h: HistoryEntry): h is Extract<HistoryEntry, { kind: 'command' }> {
  return h.kind === 'command'
}

/** Equality of two file-tree snapshots: a plain comparison of entries, no git rules
 * (what counts as staged/unstaged/untracked stays inside the engine, inspectRepo.ts). */
function sameFileTree(a: FileTree, b: FileTree): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k])
}

// ---------- Terminal ----------

function Terminal({ state, onRun }: { state: InspectState; onRun: (input: string) => void }) {
  const [draft, setDraft] = useState('')
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

  const prompt = ui.terminal.prompt(state.head)

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

// ---------- Status of the working tree ----------

function StatusPanel({ state }: { state: InspectState }) {
  const head = getHeadTree(state)
  const clean = sameFileTree(state.working, state.index) && sameFileTree(state.index, head)

  return (
    <FileAreasPanel
      title={ui.status.title}
      lines={[ui.status.branchLabel(state.head)]}
      columns={[
        { label: ui.status.workingLabel, files: Object.keys(state.working).sort() },
        { label: ui.status.indexLabel, files: Object.keys(state.index).sort() },
        { label: ui.status.headLabel, files: Object.keys(head).sort() },
      ]}
      emptyText={ui.status.empty}
      summary={clean ? ui.status.clean : ui.status.dirty}
      hint={ui.status.detailHint}
    />
  )
}

// ---------- Files in the working tree ----------

function FilesPanel({
  state,
  onEdit,
  onDelete,
  onCreate,
}: {
  state: InspectState
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
    <TrainerPanel title={ui.files.title} bodyClassName="space-y-4 px-4 py-3">
      {files.length === 0 ? (
        <p className="m-0 text-muted">{ui.files.empty}</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {files.map((f) => (
            <li key={f} className="rounded-button border border-divider p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="[overflow-wrap:anywhere]">{f}</span>
                <div className="flex flex-wrap gap-2">
                  <TrainerButton onClick={() => onEdit(f)} aria-label={`${ui.files.editButton}: ${f}`}>
                    {ui.files.editButton}
                  </TrainerButton>
                  <TrainerButton onClick={() => onDelete(f)} aria-label={`${ui.files.deleteButton}: ${f}`}>
                    {ui.files.deleteButton}
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
          placeholder={ui.files.newFileNamePlaceholder}
          aria-label={ui.files.newFileNamePlaceholder}
          spellCheck={false}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-button border border-tile-line bg-tile px-3 font-mono text-[16px] text-ink placeholder:text-muted sm:text-[14px]"
        />
        <TrainerButton onClick={submitCreate}>{ui.files.createButton}</TrainerButton>
      </div>
    </TrainerPanel>
  )
}

// ---------- The whole trainer ----------

export default function InspectTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<InspectState>(createInitialState)

  function handleRun(input: string) {
    const { state: next, result } = runInspectCommand(state, input)
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
    setState(createInitialState())
  }

  const missions = getInspectMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.gitInspecting.windowTitle}
      heading={ui.heading}
      subheading={ui.subheading}
      intro={ui.intro}
      actions={<TrainerButton onClick={handleReset}>{ui.resetButton}</TrainerButton>}
    >
      <p className="m-0 max-w-[65ch] text-[14px] text-muted">{ui.noAuthorDateNote}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Terminal state={state} onRun={handleRun} />
        <div className="min-w-0 space-y-6">
          <StatusPanel state={state} />
          <FilesPanel state={state} onEdit={handleEdit} onDelete={handleDelete} onCreate={handleCreate} />
        </div>
      </div>

      <TrainerMissions title={ui.missions.title} missions={missions} />
    </TrainerWindow>
  )
}
