import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import AppendixTrainer from './AppendixTrainer'
import source from './AppendixTrainer.tsx?raw'
import { createAppendixSection, getAppendixMissions, getFileContent, getWorkingFiles } from './engine/appendixSection'
import { ru } from './locales/ru'

const ui = ru.appendix.ui

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
    await run(user, 'git rebase -i master')
    expect(within(log()).getByText(/\[тренажёр\]/)).toBeInTheDocument()
  })

  describe('prompt', () => {
    it('shows the detached prompt with the first 7 characters of the commit id after git switch --detach', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git switch --detach')
      const tip = initial().branches.master
      expect(screen.getAllByText(`(HEAD detached at ${tip.slice(0, 7)}) $`).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/^\(HEAD detached at [0-9a-f]{7}\) \$$/).length).toBeGreaterThan(0)
      expect(screen.queryByText('(master) $')).toBeNull()
    })

    it('shows the detached prompt after git checkout <tag>, with the Note block in the log', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git tag v1.0.0')
      await run(user, 'git checkout v1.0.0')
      const shortId = createAppendixSection().branches.master.slice(0, 7)
      expect(screen.getAllByText(ui.terminal.promptDetached(shortId)).length).toBeGreaterThan(0)
      expect(within(log()).getByText(/Note: switching to 'v1.0.0'\./)).toBeInTheDocument()
    })

    it('returns to the branch prompt after git switch <branch>', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git switch --detach')
      expect(screen.queryByText('(master) $')).toBeNull()
      await run(user, 'git switch master')
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

    it('marks a commit that no branch reaches as faded with a word from the dictionary', async () => {
      const user = userEvent.setup()
      renderScreen()
      expect(graph().querySelector('[data-faded]')).toBeNull()
      await run(user, 'git reset --hard HEAD~1')
      const faded = graph().querySelector('[data-faded]')
      expect(faded).not.toBeNull()
      expect(within(faded as HTMLElement).getByText(ru.appendix.seed.readmeMessage)).toBeInTheDocument()
      expect(within(faded as HTMLElement).getByText(ui.commitGraph.fadedNote, { exact: false })).toBeInTheDocument()
    })

    it('makes the rescued commit ordinary again', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git reset --hard HEAD~1')
      expect(graph().querySelector('[data-faded]')).not.toBeNull()
      await run(user, 'git reset --hard HEAD@{{1}')
      expect(graph().querySelector('[data-faded]')).toBeNull()
    })
  })

  describe('step B commands through the screen', () => {
    it('runs git reset --hard and writes the engine answer into the history', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git reset --hard HEAD~1')
      expect(within(log()).getByText(/HEAD is now at [0-9a-f]{7}/)).toBeInTheDocument()
    })

    it('runs git cherry-pick and writes the new commit subject into the history', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git cherry-pick feature~1')
      expect(within(log()).getByText(/\[master [0-9a-f]{7}\] fix: опечатка в логе/)).toBeInTheDocument()
    })

    it('runs git reflog and writes the journal into the history', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git reflog')
      expect(within(log()).getByText(/HEAD@\{0\}:/)).toBeInTheDocument()
    })

    it('runs git switch -c to create and move to a branch, then git branch -d to delete it', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git switch -c test')
      expect(screen.getAllByText('(test) $').length).toBeGreaterThan(0)
      await run(user, 'git switch master')
      await run(user, 'git branch -d test')
      expect(within(log()).getByText(/Deleted branch test/)).toBeInTheDocument()
    })

    it('runs git rebase and writes the final line into the history', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git checkout feature')
      await run(user, 'git rebase master')
      expect(within(log()).getByText(/Successfully rebased and updated refs\/heads\/feature\./)).toBeInTheDocument()
    })
  })

  describe('verdicts and area refusals', () => {
    it('shows a successful rebase without a failure mark', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git checkout feature')
      await run(user, 'git rebase master')
      expect(within(log()).getByText(/Successfully rebased and updated refs\/heads\/feature\./)).toBeInTheDocument()
      expect(within(log()).queryByText(site.trainers.failedOutput)).toBeNull()
    })

    it('shows "up to date" as a success, not a failure', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git rebase master')
      expect(within(log()).getByText(/Current branch master is up to date\./)).toBeInTheDocument()
      expect(within(log()).queryByText(site.trainers.failedOutput)).toBeNull()
    })

    it('marks a git refusal (fatal: invalid upstream) as failed', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git rebase nope')
      expect(within(log()).getByText(/fatal: invalid upstream 'nope'/)).toBeInTheDocument()
      expect(within(log()).getByText(site.trainers.failedOutput)).toBeInTheDocument()
    })

    it('marks a git refusal (error: cannot rebase) as failed', async () => {
      const user = userEvent.setup()
      renderScreen()
      await user.click(screen.getByRole('button', { name: `${ui.files.editButton}: app.js` }))
      await run(user, 'git rebase master')
      expect(within(log()).getByText(/error: cannot rebase: You have unstaged changes\./)).toBeInTheDocument()
      expect(within(log()).getByText(site.trainers.failedOutput)).toBeInTheDocument()
    })

    it('shows area refusals for rebase -i, merge and pull starting with the trainer marker', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git rebase -i master')
      await run(user, 'git merge feature')
      await run(user, 'git pull')
      expect(within(log()).getAllByText(/\[тренажёр\]/).length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('missions', () => {
    it('shows the missions in the engine order, all not done', () => {
      renderScreen()
      const panel = screen.getByRole('region', { name: ui.missions.title })
      const items = within(panel).getAllByRole('listitem')
      expect(items).toHaveLength(getAppendixMissions(initial()).length)
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

    it('completes mission 5 with git cherry-pick', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git cherry-pick feature~1')
      expect(missionItem(4)).toHaveAttribute('data-done', 'true')
    })

    it('completes mission 6 with reset --hard HEAD~1 and reset --hard HEAD@{1}', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git reset --hard HEAD~1')
      expect(missionItem(5)).toHaveAttribute('data-done', 'false')
      await run(user, 'git reset --hard HEAD@{{1}')
      expect(missionItem(5)).toHaveAttribute('data-done', 'true')
    })

    it('completes mission 7 with git checkout feature and git rebase master', async () => {
      const user = userEvent.setup()
      renderScreen()
      await run(user, 'git checkout feature')
      await run(user, 'git rebase master')
      expect(missionItem(6)).toHaveAttribute('data-done', 'true')
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

  it('starts the section over and clears faded commits', async () => {
    const user = userEvent.setup()
    renderScreen()
    await run(user, 'git reset --hard HEAD~1')
    expect(graph().querySelector('[data-faded]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: ui.resetButton }))
    expect(graph().querySelector('[data-faded]')).toBeNull()
  })

  it('has no user strings of its own', () => {
    // Every visible string comes from the dictionary: no Cyrillic literals in the screen source.
    expect(source.replace(/\/\/.*$/gm, '')).not.toMatch(/[А-Яа-яЁё]/)
  })
})
