import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import BranchingTrainer from './BranchingTrainer'
import { createBranchingSection, getBranchMissions } from './engine/branchSection'
import { ru } from './locales/ru'

const ui = ru.branching.ui

const renderScreen = () =>
  render(
    <MemoryRouter>
      <BranchingTrainer />
    </MemoryRouter>,
  )

const terminalInput = () => screen.getByRole('textbox', { name: ui.terminal.inputAriaLabel })
const log = () => screen.getByRole('log', { name: ui.terminal.title })

/** The first mission, taken from the engine data for the initial state of the section. */
const missions = () =>
  getBranchMissions(createBranchingSection(ru.branching.seed.rootMessage, { [ru.branching.seed.file]: ru.branching.seed.content }))
const firstMission = () => missions()[0]
/** The command that completes the first mission ("look at the branches"). */
const FIRST_COMMAND = 'git branch'

describe('BranchingTrainer', () => {
  it('renders inside a sky-os window with the page heading and a link back to the trainers', () => {
    renderScreen()
    const win = screen.getByRole('region', { name: site.trainers.gitBranching.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(ui.heading)
    expect(within(win).getByText(ui.subheading)).toBeInTheDocument()
    expect(within(win).getByRole('link', { name: site.trainers.backLabel })).toHaveAttribute('href', '/')
  })

  it('labels the command input', () => {
    renderScreen()
    expect(terminalInput()).toHaveAttribute('aria-label', ui.terminal.inputAriaLabel)
  })

  it('puts the command output in a polite log region', () => {
    renderScreen()
    expect(log()).toHaveAttribute('aria-live', 'polite')
    expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
  })

  it('completes the first mission with its command and marks it done', async () => {
    const user = userEvent.setup()
    renderScreen()
    const mission = firstMission()
    const item = () => screen.getByText(mission.text).closest('li')!
    expect(item()).toHaveAttribute('data-done', 'false')
    expect(within(item()).getByText(site.trainers.missionTodo, { exact: false })).toBeInTheDocument()

    await user.type(terminalInput(), `${FIRST_COMMAND}{Enter}`)

    expect(within(log()).getByText(FIRST_COMMAND)).toBeInTheDocument()
    expect(item()).toHaveAttribute('data-done', 'true')
    expect(within(item()).getByText(site.trainers.missionDone, { exact: false })).toBeInTheDocument()
    expect(terminalInput()).toHaveValue('')
  })

  it('answers an unknown command with the trainer refusal text', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), 'ls{Enter}')
    expect(within(log()).getByText(ru.errors.bashCommandNotFound('ls'), { exact: false })).toBeInTheDocument()
    expect(within(log()).getByText(site.trainers.failedOutput, { exact: false })).toBeInTheDocument()
    for (const m of missions()) {
      expect(screen.getByText(m.text).closest('li')).toHaveAttribute('data-done', 'false')
    }
  })

  it('brings the previous command back with the arrow up key', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), 'git status{Enter}')
    await user.keyboard('{ArrowUp}')
    expect(terminalInput()).toHaveValue('git status')
  })

  it('shows the commit graph as text: commit, message and the HEAD label of the current branch', () => {
    renderScreen()
    const graph = screen.getByRole('region', { name: ui.commitGraph.title })
    expect(within(graph).getByText(ru.branching.seed.rootMessage)).toBeInTheDocument()
    expect(within(graph).getAllByRole('listitem')).toHaveLength(1)
    expect(within(graph).getByText(/^HEAD → /)).toBeInTheDocument()
  })

  it('adds a branch label to the graph after the branch is created', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), 'git branch feature{Enter}')
    const graph = screen.getByRole('region', { name: ui.commitGraph.title })
    expect(within(graph).getByText('feature')).toBeInTheDocument()
  })

  it('starts the section over with the reset button', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), `${FIRST_COMMAND}{Enter}`)
    await user.click(screen.getByRole('button', { name: ui.resetButton }))
    expect(screen.getByText(firstMission().text).closest('li')).toHaveAttribute('data-done', 'false')
    expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
  })

  it('gives every file action a name that includes the file', () => {
    renderScreen()
    const edit = screen.getAllByRole('button', { name: new RegExp(ui.files.editButton) })
    expect(edit.length).toBeGreaterThan(0)
    edit.forEach((button) => expect(button.getAttribute('aria-label')).toContain(':'))
    expect(screen.getAllByRole('button', { name: new RegExp(ui.files.deleteButton) }).length).toBeGreaterThan(0)
  })
})
