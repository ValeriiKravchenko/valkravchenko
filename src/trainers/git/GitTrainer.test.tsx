import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import GitTrainer from './GitTrainer'
import { createSection, getMissions } from './engine'
import { ru } from './locales/ru'

const renderScreen = () =>
  render(
    <MemoryRouter>
      <GitTrainer />
    </MemoryRouter>,
  )

const terminalInput = () => screen.getByRole('textbox', { name: ru.ui.terminal.inputAriaLabel })
const log = () => screen.getByRole('log', { name: ru.ui.terminal.title })

/** The first mission and the command that completes it, taken from the engine data. */
const firstMission = () => getMissions(createSection())[0]

describe('GitTrainer', () => {
  it('renders inside a sky-os window with the page heading and a link back to the trainers', () => {
    renderScreen()
    const win = screen.getByRole('region', { name: site.trainers.git.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(ru.ui.heading)
    expect(within(win).getByRole('link', { name: site.trainers.backLabel })).toHaveAttribute('href', '/')
  })

  it('labels the command input', () => {
    renderScreen()
    expect(terminalInput()).toBeInTheDocument()
    expect(terminalInput()).toHaveAttribute('aria-label', ru.ui.terminal.inputAriaLabel)
  })

  it('puts the command output in a polite log region', () => {
    renderScreen()
    expect(log()).toHaveAttribute('aria-live', 'polite')
    expect(within(log()).getByText(`# ${ru.ui.terminal.emptyHistory}`)).toBeInTheDocument()
  })

  it('shows the output of the first mission command and marks the mission done', async () => {
    const user = userEvent.setup()
    renderScreen()
    const mission = firstMission()
    const item = () => screen.getByText(mission.text).closest('li')!
    expect(mission.done).toBe(false)
    expect(item()).toHaveAttribute('data-done', 'false')
    expect(within(item()).getByText(site.trainers.missionTodo, { exact: false })).toBeInTheDocument()

    await user.type(terminalInput(), `${mission.hint}{Enter}`)

    expect(within(log()).getByText(mission.hint)).toBeInTheDocument()
    expect(within(log()).getByText(/Initialized empty Git repository/)).toBeInTheDocument()
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
    // The refused command does not complete any mission.
    for (const m of getMissions(createSection())) {
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

  it('starts the section over with the reset button', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), `${firstMission().hint}{Enter}`)
    await user.click(screen.getByRole('button', { name: ru.ui.resetButton }))
    expect(screen.getByText(firstMission().text).closest('li')).toHaveAttribute('data-done', 'false')
    expect(within(log()).getByText(`# ${ru.ui.terminal.emptyHistory}`)).toBeInTheDocument()
  })

  it('gives every file action a name that includes the file', () => {
    renderScreen()
    const edit = screen.getAllByRole('button', { name: new RegExp(ru.ui.files.editButton) })
    expect(edit.length).toBeGreaterThan(0)
    edit.forEach((button) => expect(button.getAttribute('aria-label')).toContain(':'))
  })
})
