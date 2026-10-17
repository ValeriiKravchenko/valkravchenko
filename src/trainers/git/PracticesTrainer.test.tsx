import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import PracticesTrainer from './PracticesTrainer'
import source from './PracticesTrainer.tsx?raw'
import { createPracticesSection, getGitignoreText, getPracticesMissions, getWorkingFiles } from './engine/practicesSection'
import { ru } from './locales/ru'

const ui = ru.practices.ui
const adv = ru.practices.advice

const renderScreen = () =>
  render(
    <MemoryRouter>
      <PracticesTrainer />
    </MemoryRouter>,
  )

const terminalInput = () => screen.getByRole('textbox', { name: ui.terminal.inputAriaLabel })
const log = () => screen.getByRole('log', { name: ui.terminal.title })
const editor = () => screen.getByRole('textbox', { name: ui.gitignoreEditor.ariaLabel })
const messageField = () => screen.getByRole('textbox', { name: ui.advice.inputAriaLabel })
const report = () => screen.getByRole('group', { name: ui.advice.reportLabel })
const save = () => screen.getByRole('button', { name: ui.gitignoreEditor.saveButton })

const initial = () => createPracticesSection()
const missionItem = (index: number) => {
  const mission = getPracticesMissions(initial())[index]
  return screen.getByText(mission.text, { exact: false }).closest('li')!
}
const typeMessage = (text: string) => fireEvent.change(messageField(), { target: { value: text } })

describe('PracticesTrainer', () => {
  it('renders inside a sky-os window with the page heading and a link back to the trainers', () => {
    renderScreen()
    const win = screen.getByRole('region', { name: site.trainers.gitPractices.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(ui.heading)
    expect(within(win).getByText(ui.subheading)).toBeInTheDocument()
    expect(within(win).getByText(ui.intro)).toBeInTheDocument()
    expect(within(win).getByRole('link', { name: site.trainers.backLabel })).toHaveAttribute('href', '/')
  })

  it('labels the command input and shows the master branch without a directory path', () => {
    renderScreen()
    expect(terminalInput()).toHaveAttribute('aria-label', ui.terminal.inputAriaLabel)
    expect(screen.getByText('(master) $')).toBeInTheDocument()
  })

  it('puts the command output in a polite log region that starts with the empty-history line', () => {
    renderScreen()
    expect(log()).toHaveAttribute('aria-live', 'polite')
    expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
  })

  it('runs a command and writes it and the engine answer into the history', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), 'git status{Enter}')
    expect(within(log()).getByText('git status')).toBeInTheDocument()
    expect(within(log()).getByText(/On branch master/)).toBeInTheDocument()
    expect(within(log()).queryByText(`# ${ui.terminal.emptyHistory}`)).toBeNull()
    expect(terminalInput()).toHaveValue('')
  })

  it('does nothing on an empty line', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), '{Enter}')
    expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
  })

  it('brings the previous command back with the arrow up key', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), 'git status{Enter}')
    await user.keyboard('{ArrowUp}')
    expect(terminalInput()).toHaveValue('git status')
  })

  it('completes mission 4 with an alias and its call, and marks it done with a word', async () => {
    const user = userEvent.setup()
    renderScreen()
    expect(missionItem(3)).toHaveAttribute('data-done', 'false')
    expect(within(missionItem(3)).getByText(site.trainers.missionTodo, { exact: false })).toBeInTheDocument()

    await user.type(terminalInput(), 'git config --global alias.st status{Enter}')
    expect(missionItem(3)).toHaveAttribute('data-done', 'false')
    await user.type(terminalInput(), 'git st{Enter}')

    expect(missionItem(3)).toHaveAttribute('data-done', 'true')
    expect(within(missionItem(3)).getByText(site.trainers.missionDone, { exact: false })).toBeInTheDocument()
  })

  it('shows the four missions in the engine order', () => {
    renderScreen()
    const panel = screen.getByRole('region', { name: ui.missions.title })
    const items = within(panel).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    getPracticesMissions(initial()).forEach((m, i) => {
      expect(items[i]).toHaveTextContent(m.text)
      expect(items[i]).toHaveTextContent(m.hint)
    })
  })

  describe('.gitignore editor', () => {
    it('shows the current .gitignore under a labelled field', () => {
      renderScreen()
      expect(editor()).toHaveValue(getGitignoreText(initial()))
      expect(editor()).toHaveAttribute('aria-label', ui.gitignoreEditor.ariaLabel)
    })

    it('completes mission 1 after an exception is added and saved, and writes the note', async () => {
      const user = userEvent.setup()
      renderScreen()
      expect(missionItem(0)).toHaveAttribute('data-done', 'false')

      fireEvent.change(editor(), { target: { value: `${getGitignoreText(initial())}\n!.env.example` } })
      // Not saved yet: the rules do not act.
      expect(missionItem(0)).toHaveAttribute('data-done', 'false')
      await user.click(save())

      expect(missionItem(0)).toHaveAttribute('data-done', 'true')
      expect(within(log()).getByText(`# ${ru.practices.fileOps.gitignoreSavedNote}`)).toBeInTheDocument()
    })

    it('accepts any text, including a broken pattern, and keeps the field', async () => {
      const user = userEvent.setup()
      renderScreen()
      fireEvent.change(editor(), { target: { value: '[unclosed\n*.log' } })
      await user.click(save())
      expect(editor()).toHaveValue('[unclosed\n*.log')
      await user.type(terminalInput(), 'git check-ignore -v debug.log{Enter}')
      expect(within(log()).getByText(/\.gitignore:2:\*\.log/)).toBeInTheDocument()
    })

    it('does not add a note when the text did not change', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.click(save())
      expect(within(log()).queryByText(`# ${ru.practices.fileOps.gitignoreSavedNote}`)).toBeNull()
    })
  })

  describe('files panel', () => {
    it('lists exactly the working files, with no marks and no buttons', () => {
      renderScreen()
      const panel = screen.getByRole('region', { name: ui.files.title })
      const items = within(panel).getAllByRole('listitem').map((li) => li.textContent)
      expect(items).toEqual(getWorkingFiles(initial()))
      expect(items).toHaveLength(15)
      expect(within(panel).queryByRole('button')).toBeNull()
      expect(panel.textContent).not.toMatch(/игнорир|отслежив/i)
    })
  })

  describe('commit message advice', () => {
    it('says in the title that this is the trainer advice and not git', () => {
      renderScreen()
      const panel = screen.getByRole('region', { name: ui.advice.title })
      expect(ui.advice.title).toMatch(/совет тренажёра/i)
      expect(ui.advice.title).toMatch(/не вывод git/)
      expect(panel).toBeInTheDocument()
    })

    it('asks for a message first, and names the git answer to an empty one', () => {
      renderScreen()
      expect(within(report()).getByText(/Напиши сообщение/)).toBeInTheDocument()
      expect(within(report()).getByText(/Aborting commit due to empty commit message\./)).toBeInTheDocument()
      expect(within(report()).getByText(/коммит не создаст/)).toBeInTheDocument()
    })

    it('S7-35: a message of spaces gets the same hint', () => {
      renderScreen()
      typeMessage('   ')
      expect(within(report()).getByText(/Напиши сообщение/)).toBeInTheDocument()
    })

    it('S7-23: "fix" gets one "too general" warning', () => {
      renderScreen()
      typeMessage('fix')
      const warns = within(report()).getAllByRole('listitem').filter((li) => li.dataset.kind === 'warn')
      expect(warns).toHaveLength(1)
      expect(warns[0]).toHaveTextContent(adv.generic)
      expect(within(report()).getByText(ui.advice.warnWord, { exact: false })).toBeInTheDocument()
    })

    it('S7-24: "Fix #42" has no warning and shows an ok line', () => {
      renderScreen()
      typeMessage('Fix #42')
      const items = within(report()).getAllByRole('listitem')
      expect(items.map((li) => li.dataset.kind)).toEqual(['ok'])
      expect(items[0]).toHaveTextContent(adv.allClear)
    })

    it('S7-29 and place 11: a title over 72 characters warns and says git does not truncate it', () => {
      renderScreen()
      const message = 'Добавить валидацию адреса электронной почты пользователя при регистрации в системе'
      typeMessage(message)
      expect(within(report()).getByText(adv.tooLong([...message].length), { exact: false })).toBeInTheDocument()
      expect(report()).not.toHaveTextContent('обрежется')
      expect(report()).toHaveTextContent('Git его не обрежет')
    })

    it('S7-30 and place 11: a title with the next line right after it warns about the blank line', () => {
      renderScreen()
      typeMessage('Исправить расчёт скидки\nвторая строка')
      expect(within(report()).getByText(adv.noBlankLine, { exact: false })).toBeInTheDocument()
    })

    it('S7-35 and place 11: empty message text mentions the git answer and that no commit is made', () => {
      renderScreen()
      typeMessage('')
      expect(report()).toHaveTextContent('Aborting commit due to empty commit message.')
      expect(report()).toHaveTextContent('коммит не создаст')
    })

    it('S7-38: 60 capital letters give the one-word warning and the counter "60 / 50"', () => {
      renderScreen()
      typeMessage('А'.repeat(60))
      expect(report()).toHaveTextContent('60 / 50 символов')
      expect(within(report()).getByText(adv.oneWord, { exact: false })).toBeInTheDocument()
      expect(within(report()).getAllByRole('listitem').map((li) => li.dataset.kind)).toEqual(['warn', 'info', 'info'])
    })

    it('S7-36 and S7-37: the three example buttons fill the field', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.click(screen.getByRole('button', { name: ui.advice.bodyButton }))
      expect(messageField()).toHaveValue(adv.examples.body)
      expect(report()).toHaveTextContent('тело: 2 строки')
      await user.click(screen.getByRole('button', { name: ui.advice.badButton }))
      expect(within(report()).getAllByRole('listitem')[0]).toHaveAttribute('data-kind', 'warn')
      await user.click(screen.getByRole('button', { name: ui.advice.goodButton }))
      expect(within(report()).getAllByRole('listitem')[0]).toHaveAttribute('data-kind', 'ok')
    })

    it('treats "#" as an ordinary character', () => {
      renderScreen()
      typeMessage('# не комментарий при -m')
      expect(within(report()).getAllByRole('listitem').map((li) => li.dataset.kind)).toEqual(['ok'])
    })

    it('shows the closing line that this is trainer advice, under the report and under the hint', () => {
      renderScreen()
      expect(ui.advice.footnote).toBe('Это совет тренажёра. Git сообщение не оценивает и примет любое непустое.')
      expect(within(report()).getByText(ui.advice.footnote)).toBeInTheDocument()
      typeMessage('Добавить валидацию email')
      expect(within(report()).getByText(ui.advice.footnote)).toBeInTheDocument()
    })

    it('gives every mark a word for screen readers', () => {
      renderScreen()
      typeMessage('Добавил валидацию email.')
      const items = within(report()).getAllByRole('listitem')
      expect(items.map((li) => li.dataset.kind)).toEqual(['ok', 'info', 'info'])
      expect(within(items[0]).getByText(ui.advice.okWord, { exact: false })).toHaveClass('sr-only')
      expect(within(items[1]).getByText(ui.advice.infoWord, { exact: false })).toHaveClass('sr-only')
    })
  })

  it('starts the section over: history, missions, editor text and message are reset', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(terminalInput(), 'git config --global alias.st status{Enter}')
    await user.type(terminalInput(), 'git st{Enter}')
    fireEvent.change(editor(), { target: { value: 'changed' } })
    await user.click(save())
    fireEvent.change(editor(), { target: { value: 'unsaved text' } })
    typeMessage('fix')

    await user.click(screen.getByRole('button', { name: ui.resetButton }))

    expect(missionItem(3)).toHaveAttribute('data-done', 'false')
    expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
    expect(editor()).toHaveValue(getGitignoreText(initial()))
    expect(messageField()).toHaveValue('')
    await user.type(terminalInput(), 'git check-ignore -v debug.log{Enter}')
    expect(within(log()).getByText(/\.gitignore:1:\*\.log/)).toBeInTheDocument()
  })

  it('does not show the config files and has no user strings of its own', () => {
    renderScreen()
    expect(screen.queryByText(/\.gitconfig/)).toBeNull()
    expect(screen.queryByText(/\[core\]/)).toBeNull()
    expect(source).not.toContain('getConfigFileText')
    // Every visible string comes from the dictionary: no Cyrillic literals in the screen source.
    expect(source.replace(/\/\/.*$/gm, '')).not.toMatch(/[А-Яа-яЁё]/)
  })
})
