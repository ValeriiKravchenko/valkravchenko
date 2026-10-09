// ============================================================
// Git trainer, section 6 (searching), step A: screen. State lives in the engine
// (engine/searchSection.ts): this file only shows SearchState and passes the
// player's input to runSearchCommand. No git behaviour is decided here. Markup and
// classes follow the sky-os design tokens.
//
// A shortened analogue of section 3: terminal, files, missions, "start over". No
// status panel and no commit graph: files are never edited, the working tree, the
// index and HEAD are always one snapshot, and there is a single branch. Step B
// (git bisect) is not in the engine, so there is no second terminal here.
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
import { createSearchSection, getHeadTree, getSearchMissions, runSearchCommand } from './engine/searchSection'
import type { SearchState } from './engine/searchSection'
import { ru } from './locales/ru'

const rs = ru.searching
const ui = rs.ui

function createInitialState(): SearchState {
  return createSearchSection(rs.seed)
}

// ---------- Terminal ----------

function Terminal({ state, onRun }: { state: SearchState; onRun: (input: string) => void }) {
  const { draft, setDraft, outputRef, onKeyDown } = useCommandHistory(state.history, onRun)

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

// ---------- Files of the project ----------
//
// Unlike the files panel of sections 1-4 there is no edit, create or delete here:
// the repository never has file edits. It shows exactly the tree of the commit the
// single branch points to (getHeadTree); the panel only shows state.

function FilesPanel({ state }: { state: SearchState }) {
  const head = getHeadTree(state)
  const files = Object.keys(head).sort()

  return (
    <TrainerPanel title={ui.files.title}>
      <ul className="m-0 list-none space-y-3 p-0">
        {files.map((f) => (
          <li key={f} className="rounded-button border border-divider p-3">
            <span className="[overflow-wrap:anywhere]">{f}</span>
            <pre className="m-0 mt-2 font-mono text-[13px] whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">
              {head[f]}
            </pre>
          </li>
        ))}
      </ul>
    </TrainerPanel>
  )
}

// ---------- The whole trainer ----------

export default function SearchTrainer() {
  const t = useDictionary()
  const [state, setState] = useState<SearchState>(createInitialState)

  function handleRun(input: string) {
    const { state: next, result } = runSearchCommand(state, input)
    if (result === null) return
    setState(next)
  }
  function handleReset() {
    setState(createInitialState())
  }

  const missions = getSearchMissions(state)

  return (
    <TrainerWindow
      windowTitle={t.trainers.gitSearching.windowTitle}
      heading={ui.heading}
      subheading={ui.subheading}
      intro={ui.intro}
      actions={<TrainerButton onClick={handleReset}>{ui.resetButton}</TrainerButton>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Terminal state={state} onRun={handleRun} />
        <FilesPanel state={state} />
      </div>

      <TrainerMissions title={ui.missions.title} missions={missions} />
    </TrainerWindow>
  )
}
