// ============================================================
// Git trainer, section 5 (collaborating): screen. State lives in the engine
// (engine/remoteSection.ts): this file only shows RemoteState and passes the
// player's actions to runRemoteCommand/colleaguePush/editFile/deleteFile/createFile.
// No git behaviour is decided here. Markup and classes follow the sky-os design tokens.
//
// Differences from section 2 (terminal, status, commit graph, files, missions):
// - before `git clone` there is no local copy (`state.local === null`): the status,
//   graph and files panels say so instead of showing empty lists;
// - next to the copy's graph stands the panel of the server /team/origin with its own
//   branches and commits; its notes are the trainer's speech (state.serverNotes), not
//   git output, and the server terminal is read-only;
// - on the copy's graph the commit that `origin/<branch>` points to carries that label
//   next to the local branches (a record of the server at the last contact);
// - the "colleague pushes" button calls the engine's colleaguePush.
// The status panel shows only raw file lists and the upstream record; the
// staged / ahead / behind split is left to `git status` in the terminal.
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
  colleaguePush,
  createFile,
  createRemoteSection,
  deleteFile,
  editFile,
  getAllLocalCommits,
  getAllServerCommits,
  getLocalCurrentBranch,
  getLocalHeadTree,
  getRemoteMissions,
  getServerNotes,
  runRemoteCommand,
} from './engine/remoteSection'
import type { FileTree, HistoryEntry, RemoteCommit, RemoteState } from './engine/remoteSection'
import { ru } from './locales/ru'

const rr = ru.remote
const ui = rr.ui

function createInitialState(): RemoteState {
  return createRemoteSection({ server: rr.seed.server })
}

function isCommandEntry(h: HistoryEntry): h is Extract<HistoryEntry, { kind: 'command' }> {
  return h.kind === 'command'
}

/** Equality of two file-tree snapshots: a plain comparison of entries, no git rules. */
function sameFileTree(a: FileTree, b: FileTree): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k])
}

/** Topological order (parents before children): sorting and layout are the interface's job,
 * used for both the copy's graph and the server's graph (the same commit shape, RemoteCommit). The tie-break by id only keeps the drawing
 * order stable and affects nothing in the model. */
function topologicalOrder(commits: RemoteCommit[]): RemoteCommit[] {
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

// ---------- Terminal LOCAL ----------

function Terminal({ state, onRun }: { state: RemoteState; onRun: (input: string) => void }) {
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

  const prompt = ui.terminalLocal.prompt(getLocalCurrentBranch(state))

  return (
    <TerminalPanel
      title={ui.terminalLocal.title}
      className="h-[420px] md:h-[520px]"
      footer={
        <TerminalInput
          label={ui.terminalLocal.inputAriaLabel}
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
          placeholder={ui.terminalLocal.placeholder}
        />
      }
    >
      <TerminalLog ref={outputRef} label={ui.terminalLocal.title} className="space-y-3">
        <TerminalHistory entries={state.history} prompt={prompt} emptyText={ui.terminalLocal.emptyHistory} />
      </TerminalLog>
    </TerminalPanel>
  )
}

// ---------- Status of the copy ----------

function StatusPanel({ state }: { state: RemoteState }) {
  const local = state.local
  if (!local) {
    return (
      <TrainerPanel title={ui.status.title}>
        <p className="m-0 text-muted">{ui.status.notClonedYet}</p>
      </TrainerPanel>
    )
  }
  const head = getLocalHeadTree(state) ?? {}
  const upstream = local.upstream[local.head]
  const clean = sameFileTree(local.working, local.index) && sameFileTree(local.index, head)

  return (
    <FileAreasPanel
      title={ui.status.title}
      lines={[
        ui.status.branchLabel(getLocalCurrentBranch(state)!),
        upstream ? ui.status.upstreamLabel(upstream) : ui.status.noUpstream,
      ]}
      columns={[
        { label: ui.status.workingLabel, files: Object.keys(local.working).sort() },
        { label: ui.status.indexLabel, files: Object.keys(local.index).sort() },
        { label: ui.status.headLabel, files: Object.keys(head).sort() },
      ]}
      emptyText={ui.status.empty}
      summary={clean ? ui.status.clean : ui.status.dirty}
      hint={ui.status.detailHint}
    />
  )
}

// ---------- Commit graph of the copy ----------
//
// A list of text lines (id, message, parents of a merge, branch labels, origin/<branch>
// labels), so a screen reader gets all of it as text and needs no image alternative.

function LocalCommitGraph({ state }: { state: RemoteState }) {
  if (!state.local) {
    return (
      <TrainerPanel title={ui.commitGraph.title}>
        <p className="m-0 text-muted">{ui.commitGraph.notClonedYet}</p>
      </TrainerPanel>
    )
  }
  const local = state.local
  const currentBranch = getLocalCurrentBranch(state)!

  const branchesAtCommit = new Map<string, string[]>()
  Object.keys(local.branches)
    .sort()
    .forEach((name) => {
      const list = branchesAtCommit.get(local.branches[name]) ?? []
      list.push(name)
      branchesAtCommit.set(local.branches[name], list)
    })

  // origin/<branch> is a record of the server at the last contact (clone/fetch/successful push),
  // not the server itself: a label separate from the local branches.
  const originAtCommit = new Map<string, string[]>()
  Object.keys(local.remoteBranches)
    .sort()
    .forEach((name) => {
      const list = originAtCommit.get(local.remoteBranches[name]) ?? []
      list.push(ui.commitGraph.originTag(name))
      originAtCommit.set(local.remoteBranches[name], list)
    })

  const commits = topologicalOrder(getAllLocalCommits(state)).reverse()
  const items: CommitListItem[] = commits.map((c) => {
    const names = branchesAtCommit.get(c.id) ?? []
    const tags = [
      ...(names.includes(currentBranch) ? [ui.commitGraph.headTag(currentBranch)] : []),
      ...names.filter((n) => n !== currentBranch),
      ...(originAtCommit.get(c.id) ?? []),
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

// ---------- Server panel ----------
//
// The trainer's speech, not git output: the server terminal is read-only and must not look like
// git. It shows the server's own branches and commits (a graph separate from the copy's) and the
// notes about the colleague's actions (state.serverNotes), plus the button that creates them.

function ServerPanel({ state, onColleaguePush }: { state: RemoteState; onColleaguePush: () => void }) {
  const branchesAtCommit = new Map<string, string[]>()
  Object.keys(state.server.branches)
    .sort()
    .forEach((name) => {
      const list = branchesAtCommit.get(state.server.branches[name]) ?? []
      list.push(name)
      branchesAtCommit.set(state.server.branches[name], list)
    })

  const commits = topologicalOrder(getAllServerCommits(state)).reverse()
  const items: CommitListItem[] = commits.map((c) => ({
    id: c.id,
    message: c.message,
    tags: branchesAtCommit.get(c.id) ?? [],
  }))
  const notes = getServerNotes(state)

  return (
    <TrainerPanel title={ui.terminalServer.title} bodyClassName="space-y-4 px-4 py-3">
      <TrainerButton onClick={onColleaguePush}>{ui.colleagueButton}</TrainerButton>
      <div>
        <h3 className="m-0 mb-2 font-mono text-[13px] font-semibold text-muted">{ui.serverPanel.commitGraphTitle}</h3>
        <CommitList commits={items} />
      </div>
      <div className="border-t border-divider pt-3">
        <h3 className="m-0 mb-2 font-mono text-[13px] font-semibold text-muted">{ui.serverPanel.notesTitle}</h3>
        {notes.length === 0 ? (
          <p className="m-0 text-muted"># {ui.serverPanel.notesEmpty}</p>
        ) : (
          <ul className="m-0 list-none space-y-1 p-0">
            {notes.map((n, i) => (
              <li key={i} className="text-muted [overflow-wrap:anywhere]">
                # {n}
              </li>
            ))}
          </ul>
        )}
      </div>
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
  state: RemoteState
  onEdit: (file: string) => void
  onDelete: (file: string) => void
  onCreate: (name: string) => void
}) {
  const [newName, setNewName] = useState('')

  function submitCreate() {
    onCreate(newName)
    setNewName('')
  }

  if (!state.local) {
    return (
      <TrainerPanel title={ui.files.title}>
        <p className="m-0 text-muted">{ui.files.notClonedYet}</p>
      </TrainerPanel>
    )
  }

  const local = state.local
  const files = Object.keys(local.working).sort()

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
                {local.working[f]}
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

export default function RemoteTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<RemoteState>(createInitialState)

  function handleRun(input: string) {
    const { state: next, result } = runRemoteCommand(state, input)
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
  function handleColleaguePush() {
    setState(colleaguePush(state, rr.seed.colleague))
  }
  function handleReset() {
    setState(createInitialState())
  }

  const missions = getRemoteMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.gitCollaborating.windowTitle}
      heading={ui.heading}
      subheading={ui.subheading}
      intro={ui.intro}
      actions={<TrainerButton onClick={handleReset}>{ui.resetButton}</TrainerButton>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Terminal state={state} onRun={handleRun} />
        <div className="min-w-0 space-y-6">
          <StatusPanel state={state} />
          <LocalCommitGraph state={state} />
          <ServerPanel state={state} onColleaguePush={handleColleaguePush} />
          <FilesPanel state={state} onEdit={handleEdit} onDelete={handleDelete} onCreate={handleCreate} />
        </div>
      </div>

      <TrainerMissions title={ui.missions.title} missions={missions} />
    </TrainerWindow>
  )
}
