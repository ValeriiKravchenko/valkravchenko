// ============================================================
// Git trainer, section 4 (undoing): screen. State lives in the engine
// (engine/undoSection.ts): this file only shows UndoState and passes the player's
// actions to runUndoCommand/editFile/deleteFile/createFile/getOrphanCommits. No git
// behaviour is decided here. Markup and classes follow the sky-os design tokens.
//
// Like section 2 (terminal, status of the three areas, commit graph, files,
// missions), but the graph also lists commits that no branch reaches (the engine's
// getOrphanCommits): they are marked by a dashed border and by a remark from the
// dictionary, not by dimming alone. `git log` would not show them.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useDictionary } from '../../i18n'
import { CommitList, type CommitListItem } from '../ui/CommitList'
import { FileAreasPanel } from '../ui/FileAreas'
import { TerminalHistory } from '../ui/TerminalHistory'
import { TerminalInput, TerminalLog, TerminalPanel } from '../ui/TerminalPanel'
import { TrainerButton } from '../ui/TrainerButton'
import { TrainerMissions } from '../ui/TrainerMissions'
import { TrainerPanel } from '../ui/TrainerPanel'
import { TrainerWindow } from '../ui/TrainerWindow'
import {
  createFile,
  createUndoSection,
  deleteFile,
  editFile,
  getAllCommits,
  getCurrentBranch,
  getHeadTree,
  getOrphanCommits,
  getUndoMissions,
  runUndoCommand,
} from './engine/undoSection'
import type { FileTree, HistoryEntry, UndoCommit, UndoState } from './engine/undoSection'
import { ru } from './locales/ru'

const rud = ru.undo
const ui = rud.ui

function createInitialState(): UndoState {
  return createUndoSection(rud.seed)
}

function isCommandEntry(h: HistoryEntry): h is Extract<HistoryEntry, { kind: 'command' }> {
  return h.kind === 'command'
}

/** Equality of two file-tree snapshots: a plain comparison of entries, no git rules
 * (what counts as staged/unstaged/untracked stays inside the engine, undoRepo.ts). */
function sameFileTree(a: FileTree, b: FileTree): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k])
}

// ---------- Terminal ----------

function Terminal({ state, onRun }: { state: UndoState; onRun: (input: string) => void }) {
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

  const prompt = ui.terminal.prompt(getCurrentBranch(state))

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

function StatusPanel({ state }: { state: UndoState }) {
  const head = getHeadTree(state)
  const clean = sameFileTree(state.working, state.index) && sameFileTree(state.index, head)

  return (
    <FileAreasPanel
      title={ui.status.title}
      lines={[ui.status.branchLabel(getCurrentBranch(state))]}
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

// ---------- Commit graph ----------

/** Topological order (parents before children): sorting and layout are the interface's job,
 * see the comment above getAllCommits in undoSection.ts. Unlike section 2 a commit has at most
 * one parent (undoTypes.ts), so the level follows the parentId chain; the tie-break by id only keeps the drawing order stable
 * and affects nothing in the model. */
function topologicalOrder(commits: UndoCommit[]): UndoCommit[] {
  const byId = new Map(commits.map((c) => [c.id, c]))
  const level = new Map<string, number>()
  function levelOf(id: string): number {
    const cached = level.get(id)
    if (cached !== undefined) return cached
    const c = byId.get(id)
    const l = c && c.parentId ? 1 + levelOf(c.parentId) : 0
    level.set(id, l)
    return l
  }
  commits.forEach((c) => levelOf(c.id))
  return commits.slice().sort((a, b) => {
    const diff = levelOf(a.id) - levelOf(b.id)
    if (diff !== 0) return diff
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

// The graph is a list of text lines (id, message, branch labels, a remark for unreachable commits),
// so a screen reader gets all of it as text and needs no image alternative.
function CommitGraph({ state }: { state: UndoState }) {
  const currentBranch = getCurrentBranch(state)
  const branchesAtCommit = new Map<string, string[]>()
  Object.keys(state.branches)
    .sort()
    .forEach((name) => {
      const tip = state.branches[name]
      const list = branchesAtCommit.get(tip) ?? []
      list.push(name)
      branchesAtCommit.set(tip, list)
    })

  // Commits that no branch reaches come from the engine (getOrphanCommits), not from a guess of the interface.
  const orphanIds = new Set(getOrphanCommits(state).map((c) => c.id))
  const commits = topologicalOrder(getAllCommits(state)).reverse()
  const items: CommitListItem[] = commits.map((c) => {
    const names = branchesAtCommit.get(c.id) ?? []
    // The current branch comes first with a HEAD label (like "HEAD -> name" in real git), the others follow.
    const tags = [
      ...(names.includes(currentBranch) ? [ui.commitGraph.headTag(currentBranch)] : []),
      ...names.filter((n) => n !== currentBranch),
    ]
    const isOrphan = orphanIds.has(c.id)
    return {
      id: c.id,
      message: c.message,
      tags,
      faded: isOrphan,
      note: isOrphan ? ui.commitGraph.orphanNote(c.id) : undefined,
    }
  })

  return (
    <TrainerPanel title={ui.commitGraph.title}>
      <CommitList commits={items} />
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
  state: UndoState
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

export default function UndoTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<UndoState>(createInitialState)

  function handleRun(input: string) {
    const { state: next, result } = runUndoCommand(state, input)
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

  const missions = getUndoMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.gitUndoing.windowTitle}
      heading={ui.heading}
      subheading={ui.subheading}
      intro={ui.intro}
      actions={<TrainerButton onClick={handleReset}>{ui.resetButton}</TrainerButton>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Terminal state={state} onRun={handleRun} />
        <div className="min-w-0 space-y-6">
          <StatusPanel state={state} />
          <CommitGraph state={state} />
          <FilesPanel state={state} onEdit={handleEdit} onDelete={handleDelete} onCreate={handleCreate} />
        </div>
      </div>

      <TrainerMissions title={ui.missions.title} missions={missions} />
    </TrainerWindow>
  )
}
