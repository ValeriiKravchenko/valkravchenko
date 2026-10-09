import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import SearchTrainer from './SearchTrainer'
import { createSearchSection, getSearchMissions } from './engine/searchSection'
import { ru } from './locales/ru'

const ui = ru.searching.ui

const renderScreen = () =>
  render(
    <MemoryRouter>
      <SearchTrainer />
    </MemoryRouter>,
  )

const terminalInput = () => screen.getByRole('textbox', { name: ui.terminal.inputAriaLabel })
const log = () => screen.getByRole('log', { name: ui.terminal.title })

/** The first mission, taken from the engine data for the initial state of the section. */
const missions = () => getSearchMissions(createSearchSection(ru.searching.seed))
const firstMission = () => missions()[0]
/** The command that completes the first mission ("search for debounce"). */
const FIRST_COMMAND = 'git grep -n debounce'

describe('SearchTrainer', () => {
  it('renders inside a sky-os window with the page heading and a link back to the trainers', () => {
    renderScreen()
    const win = screen.getByRole('region', { name: site.trainers.gitSearching.windowTitle })
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

  it('shows the files of the project without edit or delete buttons', () => {
    renderScreen()
    const files = screen.getByRole('region', { name: ui.files.title })
    expect(within(files).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(files).queryByRole('button')).toBeNull()
  })

  it('brings the previous command back with the arrow up key', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), 'git status{Enter}')
    await user.keyboard('{ArrowUp}')
    expect(terminalInput()).toHaveValue('git status')
  })

  it('starts the section over with the reset button', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), `${FIRST_COMMAND}{Enter}`)
    await user.click(screen.getByRole('button', { name: ui.resetButton }))
    expect(screen.getByText(firstMission().text).closest('li')).toHaveAttribute('data-done', 'false')
    expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
  })
})
