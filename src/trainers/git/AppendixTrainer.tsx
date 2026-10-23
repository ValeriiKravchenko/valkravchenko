// ============================================================
// Git trainer, section 8 (appendix), steps A, B and C: screen. State lives in the engine
// (engine/appendixSection.ts): this file only shows AppendixState and passes the player's
// input to it. No git behaviour is decided here; git output, explanations and refusals come
// from the engine history, the graph labels come ready from getCommits.
//
// Parts: terminal, conflict frame (trainer speech while a conflict or an unfinished operation
// is on), commit graph with labels, list of files (edit, delete, create; unmerged paths with
// their code, marker lines highlighted, editor buttons), missions, the note on how the trainer
// differs from real git. No panels for tags and stashes: they are
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
  chooseConflictPart,
  editAppendixFile,
  getAppendixMissions,
  getCommits,
  getConflictFiles,
  getConflictView,
  getFileContent,
  getWorkingFiles,
  resetAppendixSection,
  runAppendixCommand,
} from './engine/appendixSection'
import type { AppendixState, ConflictView } from './engine/appendixSection'
import { ru } from './locales/ru'

const ui = ru.appendix.ui
const cui = ru.conflicts.ui

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

// ---------- Conflict frame ----------
//
// Trainer speech, shown while getConflictView is not null. The finish and abort lines are picked
// by the keys the engine puts into the view; paths and codes come from view.unmerged. It is a
// polite status region and says "trainer speech, not git output" in words.

function operationText(view: ConflictView): string {
  if (view.operation === 'cherry-pick') return cui.frame.operationCherryPick
  if (view.operation === 'rebase') return cui.frame.operationRebase
  return cui.frame.operationStash
}

function ConflictFrame({ view }: { view: ConflictView | null }) {
  return (
    <output aria-live="polite" className="block empty:-mb-6">
      {view !== null && (
        <TrainerPanel title={cui.frame.title} bodyClassName="space-y-2 border-l-4 border-accent px-4 py-3 text-[15px]">
          <p className="m-0 font-mono text-[13px] text-muted">{cui.frame.speaker}</p>
          <p className="m-0">
            <strong>{cui.frame.operationLabel}:</strong> {operationText(view)}
          </p>
          <div>
            <strong>{cui.frame.unmergedLabel}:</strong>
            {view.unmerged.length === 0 ? (
              <p className="m-0">{cui.frame.noUnmerged}</p>
            ) : (
              <ul className="m-0 list-none space-y-1 p-0 pt-1">
                {view.unmerged.map((u) => (
                  <li key={u.path} className="[overflow-wrap:anywhere]">
                    <span className="font-mono">{u.code}</span> {ru.conflicts[u.kindKey]}: <span className="font-mono">{u.path}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="m-0">
            <strong>{cui.frame.finishLabel}:</strong> {ru.conflicts[view.finishKey]}
          </p>
          <p className="m-0">
            <strong>{cui.frame.abortLabel}:</strong> {ru.conflicts[view.abortKey]}
          </p>
        </TrainerPanel>
      )}
    </output>
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
//
// Unmerged paths (word and `UU` / `AA` code) come from getConflictView; marker lines in a file are
// highlighted here; the editor buttons come from getConflictFiles and only change the working copy.

const MARKER_LINE = /^(<{7}|={7}|>{7})( |$)/

function FileText({ text }: { text: string }) {
  const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n')
  return (
    <pre className="m-0 mt-2 font-mono text-[13px] whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">
      {lines.map((line, i) =>
        MARKER_LINE.test(line) ? (
          <span key={i} data-marker="true" className="block border-l-4 border-accent bg-chip pl-2 font-semibold text-ink">
            {line}
          </span>
        ) : (
          <span key={i} className="block">
            {line}
          </span>
        ),
      )}
    </pre>
  )
}

function FilesPanel({
  state,
  onEdit,
  onDelete,
  onCreate,
  onChoose,
}: {
  state: AppendixState
  onEdit: (file: string) => void
  onDelete: (file: string) => void
  onCreate: (name: string) => void
  onChoose: (file: string, part: 'top' | 'bottom' | 'both') => void
}) {
  const [newName, setNewName] = useState('')
  const files = getWorkingFiles(state)
  const view = getConflictView(state)
  const unmerged = view?.unmerged ?? []
  const conflictFiles = getConflictFiles(state)
  // An unmerged path whose file was deleted from the directory is not in getWorkingFiles but is still unmerged.
  const goneUnmerged = unmerged.filter((u) => !files.includes(u.path))

  function submitCreate() {
    onCreate(newName)
    setNewName('')
  }

  return (
    <TrainerPanel title={ui.files.title} bodyClassName="space-y-4 px-4 py-3">
      {files.length === 0 && goneUnmerged.length === 0 ? (
        <p className="m-0 text-muted">{ui.files.empty}</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {files.map((f) => {
            const entry = unmerged.find((u) => u.path === f)
            const conflict = conflictFiles.find((c) => c.path === f)
            return (
              <li key={f} className="rounded-button border border-divider p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="[overflow-wrap:anywhere]">
                    {f}
                    {entry && (
                      <span className="ml-2 inline-flex gap-1 rounded-chip border border-chip-line bg-chip px-1.5 text-[13px] text-muted">
                        <span className="font-mono" title={cui.files.statusCodeLabel}>
                          {entry.code}
                        </span>
                        <span>{cui.files.unmergedWord}</span>
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <TrainerButton onClick={() => onEdit(f)} aria-label={`${ui.files.editButton}: ${f}`}>
                      {ui.files.editButton}
                    </TrainerButton>
                    <TrainerButton onClick={() => onDelete(f)} aria-label={`${ui.files.deleteButton}: ${f}`}>
                      {ui.files.deleteButton}
                    </TrainerButton>
                  </div>
                </div>
                <FileText text={getFileContent(state, f) ?? ''} />
                {conflict && (
                  <fieldset className="m-0 mt-3 min-w-0 space-y-2 border-0 p-0">
                    <legend className="p-0 text-[14px] text-muted">
                      {cui.editor.groupLabel}
                      <span className="sr-only">: {f}</span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      <TrainerButton onClick={() => onChoose(f, 'top')} aria-label={`${cui.editor.keepPart(conflict.topLabel)}: ${f}`}>
                        {cui.editor.keepPart(conflict.topLabel)}
                      </TrainerButton>
                      <TrainerButton onClick={() => onChoose(f, 'bottom')} aria-label={`${cui.editor.keepPart(conflict.bottomLabel)}: ${f}`}>
                        {cui.editor.keepPart(conflict.bottomLabel)}
                      </TrainerButton>
                      <TrainerButton onClick={() => onChoose(f, 'both')} aria-label={`${cui.editor.keepBoth}: ${f}`}>
                        {cui.editor.keepBoth}
                      </TrainerButton>
                    </div>
                    {view?.headIsNewBase === true && <p className="m-0 text-[14px] text-accent">{cui.editor.rebaseSpeech}</p>}
                  </fieldset>
                )}
              </li>
            )
          })}
          {goneUnmerged.map((u) => (
            <li key={u.path} className="rounded-button border border-dashed border-divider p-3">
              <span className="[overflow-wrap:anywhere]">{u.path}</span>
              <span className="ml-2 inline-flex gap-1 rounded-chip border border-chip-line bg-chip px-1.5 text-[13px] text-muted">
                <span className="font-mono" title={cui.files.statusCodeLabel}>
                  {u.code}
                </span>
                <span>
                  {cui.files.unmergedWord}, {cui.files.unmergedGone}
                </span>
              </span>
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
  function handleChoose(file: string, part: 'top' | 'bottom' | 'both') {
    setState(chooseConflictPart(state, file, part))
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
          <ConflictFrame view={getConflictView(state)} />
          <CommitGraph state={state} />
          <FilesPanel state={state} onEdit={handleEdit} onDelete={handleDelete} onCreate={handleCreate} onChoose={handleChoose} />
        </div>
      </div>

      <TrainerMissions title={ui.missions.title} missions={missions} />
      <NotePanel />
    </TrainerWindow>
  )
}
