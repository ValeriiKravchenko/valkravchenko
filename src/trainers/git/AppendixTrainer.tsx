// ============================================================
// Git trainer, section 8 (appendix), steps A and B: screen. State lives in the engine
// (engine/appendixSection.ts): this file only shows AppendixState and passes the player's
// input to it. No git behaviour is decided here; git output, explanations and refusals come
// from the engine history, the graph labels come ready from getCommits.
//
// Parts: terminal, commit graph with labels, list of files (edit, delete, create), missions,
// the note on how the trainer differs from real git. No panels for tags and stashes: they are
// visible through `git tag`, `git stash list` and the graph labels.
// ============================================================
import { useState } from 'react'
import { useDictionary } from '../../i18n'
import { CommitList } from '../ui/CommitList'
import type { CommitListItem } from '../ui/CommitList'
import { TerminalHistory } from '../ui/TerminalHistory'
import { TerminalInput, TerminalLog, TerminalPanel } from '../ui/TerminalPanel'
import { TrainerButton } from '../ui/TrainerButton'
import { TrainerMissions } from '../ui/TrainerMissions'
import { TrainerPanel } from '../ui/TrainerPanel'
import { TrainerWindow } from '../ui/TrainerWindow'
import { useCommandHistory } from '../ui/useCommandHistory'
import {
  createAppendixFile,
  createAppendixSection,
  deleteAppendixFile,
  editAppendixFile,
  getAppendixMissions,
  getCommits,
  getFileContent,
  getWorkingFiles,
  resetAppendixSection,
  runAppendixCommand,
} from './engine/appendixSection'
import type { AppendixState } from './engine/appendixSection'
import { ru } from './locales/ru'

const ui = ru.appendix.ui

/** Number of id characters in the detached-HEAD prompt (the same as `shortId` and `git status`). */
const SHORT_ID_LENGTH = 7

// ---------- Terminal ----------

function promptOf(state: AppendixState): string {
  return state.head.kind === 'detached'
    ? ui.terminal.promptDetached(state.head.id.slice(0, SHORT_ID_LENGTH))
    : ui.terminal.prompt(state.head.name)
}

function Terminal({ state, onRun }: { state: AppendixState; onRun: (input: string) => void }) {
  const { draft, setDraft, outputRef, onKeyDown } = useCommandHistory(state.history, onRun)

  const prompt = promptOf(state)

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

// ---------- Commit graph ----------
//
// The order and the labels (`HEAD -> master`, `tag: v1.0.0`, `feature`) come from getCommits as is.
// A commit that no branch or tag reaches and that is not under HEAD comes back `faded`: it stays on
// the graph, is shown dimmed and carries a remark from the dictionary, never by colour alone.

function CommitGraph({ state }: { state: AppendixState }) {
  const items: CommitListItem[] = getCommits(state).map((c) => ({
    id: c.shortId,
    message: c.subject,
    tags: c.decorations,
    faded: c.faded,
    note: c.faded ? ui.commitGraph.fadedNote : undefined,
  }))

  return (
    <TrainerPanel title={ui.commitGraph.title}>
      <CommitList commits={items} />
    </TrainerPanel>
  )
}

// ---------- Files in the working directory ----------

function FilesPanel({
  state,
  onEdit,
  onDelete,
  onCreate,
}: {
  state: AppendixState
  onEdit: (file: string) => void
  onDelete: (file: string) => void
  onCreate: (name: string) => void
}) {
  const [newName, setNewName] = useState('')
  const files = getWorkingFiles(state)

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
                {getFileContent(state, f)}
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
          aria-label={ui.files.newFileNameLabel}
          spellCheck={false}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-button border border-tile-line bg-tile px-3 font-mono text-[16px] text-ink placeholder:text-muted sm:text-[14px]"
        />
        <TrainerButton onClick={submitCreate}>{ui.files.createButton}</TrainerButton>
      </div>
    </TrainerPanel>
  )
}

// ---------- Note: how the trainer differs from real git ----------

function NotePanel() {
  return (
    <TrainerPanel title={ru.appendix.note.title}>
      <ul className="m-0 list-disc space-y-2 pl-5 text-[15px]">
        {ru.appendix.note.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </TrainerPanel>
  )
}

// ---------- The whole trainer ----------

export default function AppendixTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<AppendixState>(createAppendixSection)

  function handleRun(input: string) {
    const { state: next, result } = runAppendixCommand(state, input)
    if (result === null) return
    setState(next)
  }
  function handleEdit(file: string) {
    setState(editAppendixFile(state, file))
  }
  function handleDelete(file: string) {
    setState(deleteAppendixFile(state, file))
  }
  function handleCreate(name: string) {
    setState(createAppendixFile(state, name))
  }
  function handleReset() {
    setState(resetAppendixSection())
  }

  const missions = getAppendixMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.gitAppendix.windowTitle}
      heading={ui.heading}
      subheading={ui.subheading}
      intro={ui.intro}
      actions={<TrainerButton onClick={handleReset}>{ui.resetButton}</TrainerButton>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Terminal state={state} onRun={handleRun} />
        <div className="min-w-0 space-y-6">
          <CommitGraph state={state} />
          <FilesPanel state={state} onEdit={handleEdit} onDelete={handleDelete} onCreate={handleCreate} />
        </div>
      </div>

      <TrainerMissions title={ui.missions.title} missions={missions} />
      <NotePanel />
    </TrainerWindow>
  )
}
