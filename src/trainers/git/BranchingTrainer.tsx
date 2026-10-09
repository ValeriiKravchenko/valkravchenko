// ============================================================
// Git trainer, section 2 (branching): screen. State lives in the engine
// (engine/branchSection.ts): this file only shows BranchingState and passes the
// player's actions to runBranchingCommand/editFile/deleteFile/createFile. No git
// behaviour is decided here. Markup and classes follow the sky-os design tokens.
//
// The status panel shows only the raw file lists of the three areas and whether
// they match; the staged / not staged / untracked split is a git rule computed by
// the engine and is left to `git status` in the terminal. "Edit" calls the
// engine's editFile, which appends a fixed suffix (the engine takes no content).
// ============================================================
import { useState } from 'react'
import { useDictionary } from '../../i18n'
import { CommitList, type CommitListItem } from '../ui/CommitList'
import { FileAreasPanel } from '../ui/FileAreas'
import { TerminalHistory } from '../ui/TerminalHistory'
import { TerminalInput, TerminalLog, TerminalPanel } from '../ui/TerminalPanel'
import { TrainerButton } from '../ui/TrainerButton'
import { TrainerMissions } from '../ui/TrainerMissions'
import { TrainerPanel } from '../ui/TrainerPanel'
import { TrainerWindow } from '../ui/TrainerWindow'
import { useCommandHistory } from '../ui/useCommandHistory'
import {
  createBranchingSection,
  createFile,
  deleteFile,
  editFile,
  getAllCommits,
  getBranchMissions,
  getCurrentBranch,
  getHeadTree,
  runBranchingCommand,
} from './engine/branchSection'
import type { BranchCommit, BranchingState, FileTree } from './engine/branchSection'
import { ru } from './locales/ru'

const rb = ru.branching
const ui = rb.ui

function createInitialState(): BranchingState {
  return createBranchingSection(rb.seed.rootMessage, { [rb.seed.file]: rb.seed.content })
}

/** Equality of two file-tree snapshots: a plain comparison of entries, no git rules
 * (what counts as staged/unstaged/untracked stays inside the engine, branchRepo.ts). */
function sameFileTree(a: FileTree, b: FileTree): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k])
}

// ---------- Terminal ----------

function Terminal({ state, onRun }: { state: BranchingState; onRun: (input: string) => void }) {
  const { draft, setDraft, outputRef, onKeyDown } = useCommandHistory(state.history, onRun)

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

// ---------- Status of the working tree ----------

function StatusPanel({ state }: { state: BranchingState }) {
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
 * see the comment above getAllCommits in branchSection.ts. A commit's level is 1 + the maximum
 * level of its parents (0 for the root); the tie-break by id only keeps the drawing order stable
 * and affects nothing in the model. */
function topologicalOrder(commits: BranchCommit[]): BranchCommit[] {
  const byId = new Map(commits.map((c) => [c.id, c]))
  const level = new Map<string, number>()
  function levelOf(id: string): number {
    const cached = level.get(id)
    if (cached !== undefined) return cached
    const c = byId.get(id)
    const l = c && c.parents.length ? 1 + Math.max(...c.parents.map(levelOf)) : 0
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

// The graph is a list of text lines (id, message, parents of a merge, branch labels),
// so a screen reader gets all of it as text and needs no image alternative.
function CommitGraph({ state }: { state: BranchingState }) {
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

  const commits = topologicalOrder(getAllCommits(state)).reverse()
  const items: CommitListItem[] = commits.map((c) => {
    const names = branchesAtCommit.get(c.id) ?? []
    // The current branch comes first with a HEAD label (like "HEAD -> name" in real git), the others follow.
    const tags = [
      ...(names.includes(currentBranch) ? [ui.commitGraph.headTag(currentBranch)] : []),
      ...names.filter((n) => n !== currentBranch),
    ]
    return {
      id: c.id,
      message: c.message,
      tags,
      parents:
        c.parents.length === 2
          ? ui.commitGraph.mergeParents(c.parents[0].slice(0, 7), c.parents[1].slice(0, 7))
          : undefined,
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
  state: BranchingState
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

export default function BranchingTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<BranchingState>(createInitialState)

  function handleRun(input: string) {
    const { state: next, result } = runBranchingCommand(state, input)
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

  const missions = getBranchMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.gitBranching.windowTitle}
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
