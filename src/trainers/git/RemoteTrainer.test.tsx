import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import RemoteTrainer from './RemoteTrainer'
import { createRemoteSection, getRemoteMissions } from './engine/remoteSection'
import { ru } from './locales/ru'

const ui = ru.remote.ui

const renderScreen = () =>
  render(
    <MemoryRouter>
      <RemoteTrainer />
    </MemoryRouter>,
  )

const terminalInput = () => screen.getByRole('textbox', { name: ui.terminalLocal.inputAriaLabel })
const log = () => screen.getByRole('log', { name: ui.terminalLocal.title })
const region = (name: string) => screen.getByRole('region', { name })

/** The first mission, taken from the engine data for the initial state of the section. */
const missions = () => getRemoteMissions(createRemoteSection({ server: ru.remote.seed.server }))
const firstMission = () => missions()[0]
/** The command that completes the first mission ("clone the server repository"). */
const FIRST_COMMAND = 'git clone origin local'

describe('RemoteTrainer', () => {
  it('renders inside a sky-os window with the page heading and a link back to the trainers', () => {
    renderScreen()
    const win = screen.getByRole('region', { name: site.trainers.gitCollaborating.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(ui.heading)
    expect(within(win).getByText(ui.subheading)).toBeInTheDocument()
    expect(within(win).getByRole('link', { name: site.trainers.backLabel })).toHaveAttribute('href', '/trainers')
  })

  it('labels the command input', () => {
    renderScreen()
    expect(terminalInput()).toHaveAttribute('aria-label', ui.terminalLocal.inputAriaLabel)
  })

  it('puts the command output in a polite log region', () => {
    renderScreen()
    expect(log()).toHaveAttribute('aria-live', 'polite')
    expect(within(log()).getByText(`# ${ui.terminalLocal.emptyHistory}`)).toBeInTheDocument()
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
    await user.type(terminalInput(), `${FIRST_COMMAND}{Enter}`)
    await user.keyboard('{ArrowUp}')
    expect(terminalInput()).toHaveValue(FIRST_COMMAND)
  })

  it('says in text that there is no local copy before the clone, and shows the commits after it', async () => {
    const user = userEvent.setup()
    renderScreen()
    expect(within(region(ui.commitGraph.title)).getByText(ui.commitGraph.notClonedYet)).toBeInTheDocument()
    expect(within(region(ui.status.title)).getByText(ui.status.notClonedYet)).toBeInTheDocument()
    expect(within(region(ui.files.title)).getByText(ui.files.notClonedYet)).toBeInTheDocument()

    await user.type(terminalInput(), `${FIRST_COMMAND}{Enter}`)

    const graph = region(ui.commitGraph.title)
    expect(within(graph).queryByText(ui.commitGraph.notClonedYet)).toBeNull()
    expect(within(graph).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(graph).getByText(/^HEAD -> /)).toBeInTheDocument()
    expect(within(graph).getAllByText(/^origin\//).length).toBeGreaterThan(0)
  })

  it('shows the server graph as text and a colleague push adds a note', async () => {
    const user = userEvent.setup()
    renderScreen()
    const server = region(ui.terminalServer.title)
    expect(within(server).getByRole('heading', { level: 3, name: ui.serverPanel.commitGraphTitle })).toBeInTheDocument()
    expect(within(server).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(server).getByText(`# ${ui.serverPanel.notesEmpty}`)).toBeInTheDocument()

    await user.click(within(server).getByRole('button', { name: ui.colleagueButton }))

    expect(within(server).queryByText(`# ${ui.serverPanel.notesEmpty}`)).toBeNull()
  })

  it('starts the section over with the reset button', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), `${FIRST_COMMAND}{Enter}`)
    await user.click(screen.getByRole('button', { name: ui.resetButton }))
    expect(screen.getByText(firstMission().text).closest('li')).toHaveAttribute('data-done', 'false')
    expect(within(log()).getByText(`# ${ui.terminalLocal.emptyHistory}`)).toBeInTheDocument()
  })

  it('gives every file action a name that includes the file', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), `${FIRST_COMMAND}{Enter}`)
    const edit = screen.getAllByRole('button', { name: new RegExp(ui.files.editButton) })
    expect(edit.length).toBeGreaterThan(0)
    edit.forEach((button) => expect(button.getAttribute('aria-label')).toContain(':'))
    expect(screen.getAllByRole('button', { name: new RegExp(ui.files.deleteButton) }).length).toBeGreaterThan(0)
  })
})
