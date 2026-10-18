import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import AppendixTrainer from './AppendixTrainer'
import source from './AppendixTrainer.tsx?raw'
import { createAppendixSection, getAppendixMissions, getFileContent, getWorkingFiles } from './engine/appendixSection'
import { ru } from './locales/ru'

const ui = ru.appendix.ui

// The step A engine refuses `git checkout <tag>` (area refusal), so a detached HEAD cannot be reached
// by commands yet. To check the prompt format, the initial state can be swapped for a detached one.
const override = vi.hoisted(() => ({ detachedAt: null as string | null }))
vi.mock('./engine/appendixSection', async (importOriginal) => {
  const original = await importOriginal<typeof import('./engine/appendixSection')>()
  return {
    ...original,
    createAppendixSection: () => {
      const state = original.createAppendixSection()
      return override.detachedAt === null ? state : { ...state, head: { kind: 'detached' as const, id: override.detachedAt } }
    },
  }
})
afterEach(() => {
  override.detachedAt = null
})

const renderScreen = () =>
  render(
    <MemoryRouter>
      <AppendixTrainer />
    </MemoryRouter>,
  )

const terminalInput = () => screen.getByRole('textbox', { name: ui.terminal.inputAriaLabel })
const log = () => screen.getByRole('log', { name: ui.terminal.title })
const graph = () => screen.getByRole('region', { name: ui.commitGraph.title })
const filesPanel = () => screen.getByRole('region', { name: ui.files.title })
const newFileField = () => screen.getByRole('textbox', { name: ui.files.newFileNameLabel })

const initial = () => createAppendixSection()
const missionItem = (index: number) => {
  const mission = getAppendixMissions(initial())[index]
  return screen.getByText(mission.text, { exact: false }).closest('li')!
}
const doneCount = () => document.querySelectorAll('[data-done="true"]').length

async function run(user: ReturnType<typeof userEvent.setup>, line: string) {
  await user.type(terminalInput(), `${line}{Enter}`)
}

describe('AppendixTrainer', () => {
  it('renders inside a sky-os window with the page heading and a link back to the trainers', () => {
    renderScreen()
    const win = screen.getByRole('region', { name: site.trainers.gitAppendix.windowTitle })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent(ui.heading)
    expect(within(win).getByText(ui.subheading)).toBeInTheDocument()
    expect(within(win).getByText(ui.intro)).toBeInTheDocument()
    expect(within(win).getByRole('link', { name: site.trainers.backLabel })).toHaveAttribute('href', '/')
  })

  it('labels the command input and shows the branch prompt', () => {
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
    await run(user, 'git status')
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

  it('shows the area refusal from the engine history as it is', async () => {
    const user = userEvent.setup()
    renderScreen()
    await run(user, 'git rebase master')
    expect(within(log()).getByText(/\[тренажёр\]/)).toBeInTheDocument()
  })

  describe('prompt', () => {
    it('shows the detached prompt with the first 7 characters of the commit id', () => {
      const tip = initial().branches.master
      override.detachedAt = tip
      renderScreen()
      expect(screen.getByText(`(HEAD detached at ${tip.slice(0, 7)}) $`)).toBeInTheDocument()
      expect(screen.getByText(/^\(HEAD detached at [0-9a-f]{7}\) \$$/)).toBeInTheDocument()
      expect(screen.queryByText('(master) $')).toBeNull()
    })

    it('keeps the branch prompt when the engine refuses to check out a tag, and shows the refusal', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git tag v1.0.0')
      await run(user, 'git checkout v1.0.0')
      expect(within(log()).getByText(/\[тренажёр\]/)).toBeInTheDocument()
      expect(screen.getAllByText('(master) $').length).toBeGreaterThan(0)
    })
  })

  describe('commit graph', () => {
    it('lists the four commits newest first with HEAD and branch labels', () => {
      renderScreen()
      const items = within(graph()).getAllByRole('listitem')
      expect(items).toHaveLength(4)
      expect(items[0]).toHaveTextContent(ru.appendix.seed.readmeMessage)
      expect(items[0]).toHaveTextContent('HEAD -> master')
      expect(within(graph()).getByText('feature')).toBeInTheDocument()
    })

    it('shows the tag label next to HEAD -> master after a tag is created', async () => {
      const user = userEvent.setup()
      renderScreen()
      expect(within(graph()).queryByText('tag: v1.0.0')).toBeNull()
      await run(user, 'git tag v1.0.0')
      const first = within(graph()).getAllByRole('listitem')[0]
      expect(within(first).getByText('HEAD -> master')).toBeInTheDocument()
      expect(within(first).getByText('tag: v1.0.0')).toBeInTheDocument()
    })
  })

  describe('missions', () => {
    it('shows the four missions in the engine order, all not done', () => {
      renderScreen()
      const panel = screen.getByRole('region', { name: ui.missions.title })
      const items = within(panel).getAllByRole('listitem')
      expect(items).toHaveLength(4)
      getAppendixMissions(initial()).forEach((m, i) => {
        expect(items[i]).toHaveTextContent(m.text)
        expect(items[i]).toHaveTextContent(m.hint)
        expect(items[i]).toHaveAttribute('data-done', 'false')
      })
    })

    it('completes mission 1 with a light tag and marks it done with a word', async () => {
      const user = userEvent.setup()
      renderScreen()
      expect(within(missionItem(0)).getByText(site.trainers.missionTodo, { exact: false })).toBeInTheDocument()
      await run(user, 'git tag v1.0.0')
      expect(missionItem(0)).toHaveAttribute('data-done', 'true')
      expect(within(missionItem(0)).getByText(site.trainers.missionDone, { exact: false })).toBeInTheDocument()
    })

    it('completes mission 2 with an annotated tag and git show', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git tag -a v1.1.0 -m "Релиз"')
      expect(missionItem(1)).toHaveAttribute('data-done', 'false')
      await run(user, 'git show v1.1.0')
      expect(missionItem(1)).toHaveAttribute('data-done', 'true')
    })

    it('completes missions 3 and 4 with an edit, git stash and git stash pop', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.click(screen.getByRole('button', { name: `${ui.files.editButton}: app.js` }))
      await run(user, 'git stash')
      expect(missionItem(2)).toHaveAttribute('data-done', 'true')
      expect(missionItem(3)).toHaveAttribute('data-done', 'false')
      await run(user, 'git stash pop')
      expect(missionItem(3)).toHaveAttribute('data-done', 'true')
    })
  })

  describe('files panel', () => {
    it('lists the working files with their content and three buttons per set', () => {
      renderScreen()
      const files = getWorkingFiles(initial())
      const items = within(filesPanel()).getAllByRole('listitem')
      expect(items).toHaveLength(files.length)
      files.forEach((f, i) => {
        expect(items[i]).toHaveTextContent(f)
        expect(items[i]).toHaveTextContent(getFileContent(initial(), f)!.trim())
        expect(within(items[i]).getByRole('button', { name: `${ui.files.editButton}: ${f}` })).toBeInTheDocument()
        expect(within(items[i]).getByRole('button', { name: `${ui.files.deleteButton}: ${f}` })).toBeInTheDocument()
      })
    })

    it('the edit button changes the content and writes a note', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.click(screen.getByRole('button', { name: `${ui.files.editButton}: app.js` }))
      expect(within(filesPanel()).getByText(new RegExp(ru.fileOps.editedSuffix.trim().replace('+', '\\+')))).toBeInTheDocument()
      expect(within(log()).getByText(`# ${ru.fileOps.editedNote('app.js')}`)).toBeInTheDocument()
    })

    it('the delete button removes the file from the list and writes a note', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.click(screen.getByRole('button', { name: `${ui.files.deleteButton}: app.js` }))
      expect(screen.queryByRole('button', { name: `${ui.files.editButton}: app.js` })).toBeNull()
      expect(within(filesPanel()).getAllByRole('listitem')).toHaveLength(getWorkingFiles(initial()).length - 1)
      expect(within(log()).getByText(/^#.*app\.js/)).toBeInTheDocument()
    })

    it('creates a file by name and clears the field', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.type(newFileField(), 'notes.txt')
      await user.click(screen.getByRole('button', { name: ui.files.createButton }))
      expect(screen.getByRole('button', { name: `${ui.files.editButton}: notes.txt` })).toBeInTheDocument()
      expect(newFileField()).toHaveValue('')
      expect(within(log()).getByText(`# ${ru.fileOps.createdNote('notes.txt')}`)).toBeInTheDocument()
    })

    it('creates a file with the Enter key too', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.type(newFileField(), 'extra.md{Enter}')
      expect(screen.getByRole('button', { name: `${ui.files.deleteButton}: extra.md` })).toBeInTheDocument()
    })

    it('does nothing for an empty name', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.click(screen.getByRole('button', { name: ui.files.createButton }))
      expect(within(filesPanel()).getAllByRole('listitem')).toHaveLength(getWorkingFiles(initial()).length)
      expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
    })
  })

  it('shows the note on how the trainer differs from real git, from the dictionary', () => {
    renderScreen()
    const panel = screen.getByRole('region', { name: ru.appendix.note.title })
    const items = within(panel).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(ru.appendix.note.items)
  })

  it('has no panels for tags and stashes', () => {
    renderScreen()
    expect(screen.queryByRole('region', { name: /тег|тайник/i })).toBeNull()
  })

  it('starts the section over: history, graph, files and missions are reset', async () => {
    const user = userEvent.setup()
    renderScreen()
    await run(user, 'git tag v1.0.0')
    await user.click(screen.getByRole('button', { name: `${ui.files.deleteButton}: app.js` }))
    await run(user, 'git checkout v1.0.0')
    expect(doneCount()).toBe(1)

    await user.click(screen.getByRole('button', { name: ui.resetButton }))

    expect(doneCount()).toBe(0)
    expect(within(log()).getByText(`# ${ui.terminal.emptyHistory}`)).toBeInTheDocument()
    expect(screen.getByText('(master) $')).toBeInTheDocument()
    expect(within(graph()).queryByText('tag: v1.0.0')).toBeNull()
    expect(within(filesPanel()).getAllByRole('listitem')).toHaveLength(getWorkingFiles(initial()).length)
  })

  it('has no user strings of its own', () => {
    // Every visible string comes from the dictionary: no Cyrillic literals in the screen source.
    expect(source.replace(/\/\/.*$/gm, '')).not.toMatch(/[А-Яа-яЁё]/)
  })
})
