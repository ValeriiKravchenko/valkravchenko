import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { dictionary as site } from '../../i18n'
import AppendixTrainer from './AppendixTrainer'
import source from './AppendixTrainer.tsx?raw'
import {
  chooseConflictPart,
  createAppendixSection,
  editAppendixFile,
  getAppendixMissions,
  getCommits,
  getConflictFiles,
  getConflictView,
  getFileContent,
  getWorkingFiles,
  runAppendixCommand,
} from './engine/appendixSection'
import type { AppendixState } from './engine/appendixSection'
import { ru } from './locales/ru'

const ui = ru.appendix.ui
const cui = ru.conflicts.ui
const rc = ru.conflicts

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
/** Mission texts as the screen must show them (target.md, "Миссии": the wording does not change). */
const MISSION_TEXTS = [
  'Отметь текущий коммит версией — поставь лёгкий тег.',
  'Поставь аннотированный тег с сообщением (например, на текущий коммит) и посмотри, что внутри.',
  'Отредактируй app.js (кнопка ✎), но не коммить — вместо этого спрячь изменения.',
  'Верни спрятанные изменения обратно.',
  'В ветке feature два коммита. Посмотри её лог и скопируй к себе в master только фикс опечатки. (Правка app.js после stash pop ещё не закоммичена: если Git откажется копировать поверх неё — сначала верни файл командой git checkout -- app.js.)',
  'Ошибись специально и спаси коммит: откати ветку на один коммит назад жёстко, найди потерянный коммит в журнале и верни его.',
  'Переключись в feature и перебазируй её поверх master, затем посмотри историю: git log --oneline --all. Если ты уже копировал фикс в master, Git пропустит его как дубликат.',
]
const missionItem = (index: number) => screen.getByText(MISSION_TEXTS[index], { exact: false }).closest('li')!
const doneCount = () => document.querySelectorAll('[data-done="true"]').length

async function run(user: ReturnType<typeof userEvent.setup>, line: string) {
  await user.type(terminalInput(), `${line}{Enter}`)
}

// ---------- Step C helpers ----------

type User = ReturnType<typeof userEvent.setup>

const editApp = (user: User) => user.click(screen.getByRole('button', { name: `${ui.files.editButton}: app.js` }))
const framePanel = () => screen.getByRole('region', { name: cui.frame.title })
const frameAbsent = () => expect(screen.queryByRole('region', { name: cui.frame.title })).toBeNull()
const keepButton = (label: string, path = 'app.js') => screen.getByRole('button', { name: `${cui.editor.keepPart(label)}: ${path}` })
const bothButton = (path = 'app.js') => screen.getByRole('button', { name: `${cui.editor.keepBoth}: ${path}` })
const markerLines = () => Array.from(filesPanel().querySelectorAll('[data-marker="true"]')).map((el) => el.textContent ?? '')

async function runAll(user: User, lines: string[]) {
  for (const line of lines) await run(user, line)
}

/** The player's own input: an edit of app.js committed on master, then the copied fix from feature. */
const cherryPickConflict = async (user: User) => {
  await editApp(user)
  await runAll(user, ['git commit -am "master: v2"', 'git cherry-pick feature~1'])
}
/** The edit is stashed on master, HEAD moves to feature, the stash comes back with a conflict. */
const stashConflict = async (user: User, command = 'git stash pop') => {
  await editApp(user)
  await runAll(user, ['git stash', 'git checkout feature', command])
}
/** The edit is committed on master, feature is rebased onto it: stops on the first commit. */
const rebaseConflict = async (user: User) => {
  await editApp(user)
  await runAll(user, ['git commit -am "master: v2"', 'git checkout feature', 'git rebase master'])
}
/** about.html created on master and committed: the rebase of feature copies the fix and stops on about.html (both added). */
const rebaseConflictOnLastCommit = async (user: User) => {
  await user.type(newFileField(), 'about.html{Enter}')
  await runAll(user, ['git add about.html', 'git commit -m "master: about"', 'git checkout feature', 'git rebase master'])
}

// The same scenarios built straight in the engine: only to know what the engine answers (exit code, text) for a line.
const engineRun = (state: AppendixState, lines: string[]) => lines.reduce((s, line) => runAppendixCommand(s, line).state, state)
const engineEdited = () => editAppendixFile(createAppendixSection(), 'app.js')
const ENGINE = {
  'cherry-pick': () => engineRun(engineEdited(), ['git commit -am "master: v2"', 'git cherry-pick feature~1']),
  stash: () => engineRun(engineEdited(), ['git stash', 'git checkout feature', 'git stash pop']),
  rebase: () => engineRun(engineEdited(), ['git commit -am "master: v2"', 'git checkout feature', 'git rebase master']),
}
const SCREEN = { 'cherry-pick': cherryPickConflict, stash: stashConflict, rebase: rebaseConflict }

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
      // The prompt is a trainer element, not git output (target.md, part XII, "Simplifications"): always `(detached@<id7>) $`.
      expect(screen.getAllByText(`(detached@${tip.slice(0, 7)}) $`).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/^\(detached@[0-9a-f]{7}\) \$$/).length).toBeGreaterThan(0)
      expect(ui.terminal.promptDetached(tip.slice(0, 7))).toBe(`(detached@${tip.slice(0, 7)}) $`)
      expect(screen.queryByText(/^\(HEAD detached at /)).toBeNull()
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

  describe('step C: cherry-pick with a conflict', () => {
    it('stops with git exit code 1, marked failed, and shows the frame, the unmerged path and the highlighted markers', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)

      const answer = runAppendixCommand(ENGINE['cherry-pick'](), 'git status').result!
      expect(answer.ok).toBe(true)
      const stop = ENGINE['cherry-pick']().history.filter((h) => h.kind === 'command').at(-1)!
      expect(stop.kind === 'command' && stop.ok).toBe(false)
      expect(within(log()).getByText(/CONFLICT \(content\): Merge conflict in app\.js/)).toBeInTheDocument()
      expect(within(log()).getByText(site.trainers.failedOutput)).toBeInTheDocument()

      const frame = framePanel()
      expect(within(frame).getByText(cui.frame.operationCherryPick)).toBeInTheDocument()
      expect(within(frame).getByText('UU')).toBeInTheDocument()
      expect(within(frame).getByText(rc.cherryPickFinish)).toBeInTheDocument()
      expect(within(frame).getByText(rc.cherryPickAbort)).toBeInTheDocument()
      expect(within(frame).getByText(cui.frame.speaker)).toBeInTheDocument()
      expect(frame.textContent).not.toMatch(/error:|hint:/)
      expect(screen.getByRole('status')).toContainElement(frame)

      const file = within(filesPanel()).getAllByRole('listitem').find((li) => li.textContent?.includes('app.js'))!
      expect(within(file).getByText('UU')).toBeInTheDocument()
      expect(within(file).getByText(cui.files.unmergedWord)).toBeInTheDocument()
      expect(markerLines()).toHaveLength(3)
      expect(markerLines()[0]).toMatch(/^<<<<<<< HEAD$/)
      expect(markerLines()[1]).toBe('=======')
      expect(markerLines()[2]).toMatch(/^>>>>>>> [0-9a-f]{7} \(/)
      expect(missionItem(4)).toHaveAttribute('data-done', 'false')
    })

    it('shows the editor buttons with labels from the file, a group caption and no ours/theirs words', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      const [file] = getConflictFiles(ENGINE['cherry-pick']())
      expect(file.topLabel).toBe('HEAD')
      const group = screen.getByRole('group', { name: `${cui.editor.groupLabel}: app.js` })
      expect(within(group).getByText(cui.editor.groupLabel)).toBeInTheDocument()
      expect(keepButton('HEAD')).toBeInTheDocument()
      expect(keepButton(file.bottomLabel)).toBeInTheDocument()
      expect(bothButton()).toBeInTheDocument()
      expect(group.textContent).not.toMatch(/ours|theirs|своё|чужое/i)
      expect(screen.queryByText(cui.editor.rebaseSpeech)).toBeNull()
    })

    it('a button changes only the working copy: the path stays unmerged (UU) until git add, the note comes from the engine', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      const [file] = getConflictFiles(ENGINE['cherry-pick']())
      await user.click(keepButton(file.bottomLabel))

      expect(markerLines()).toHaveLength(0)
      expect(within(filesPanel()).getByText(ru.appendix.seed.appFixed.trim())).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: new RegExp(cui.editor.keepBoth) })).toBeNull()
      expect(within(log()).getByText(`# ${rc.choiceNote('bottom', 'app.js', file.topLabel, file.bottomLabel, rc.finishCherryPick)}`)).toBeInTheDocument()
      expect(within(filesPanel()).getByText('UU')).toBeInTheDocument()
      expect(within(framePanel()).getByText('UU')).toBeInTheDocument()
      await run(user, 'git status --short')
      expect(within(log()).getByText(/^UU app\.js$/)).toBeInTheDocument()
    })

    it('the edit button keeps the markers', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      await editApp(user)
      expect(markerLines()).toHaveLength(3)
    })

    it('git add leaves the finish step in the frame and names the command; --continue ends the operation and counts mission 5', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      await user.click(bothButton())
      await run(user, 'git add app.js')
      expect(within(framePanel()).getByText(rc.cherryPickFinishAdded)).toBeInTheDocument()
      expect(within(framePanel()).getByText(cui.frame.noUnmerged)).toBeInTheDocument()
      expect(missionItem(4)).toHaveAttribute('data-done', 'false')

      await run(user, 'git cherry-pick --continue')
      expect(within(log()).getByText(/\[master [0-9a-f]{7}\] fix: опечатка в логе/)).toBeInTheDocument()
      frameAbsent()
      expect(missionItem(4)).toHaveAttribute('data-done', 'true')
    })

    it('git status in the middle of the operation, --skip and --abort end it without mission 5', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      await run(user, 'git status')
      expect(within(log()).getByText(/You are currently cherry-picking commit/)).toBeInTheDocument()
      await run(user, 'git cherry-pick --skip')
      expect(log().textContent).toContain(`💡 ${rc.cherryPickSkipped}`)
      frameAbsent()
      expect(markerLines()).toHaveLength(0)
      expect(missionItem(4)).toHaveAttribute('data-done', 'false')
    })

    it('--abort ends the operation without mission 5', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      await run(user, 'git cherry-pick --abort')
      frameAbsent()
      expect(markerLines()).toHaveLength(0)
      expect(missionItem(4)).toHaveAttribute('data-done', 'false')
    })

    it('a git refusal in the middle of the conflict (commit with unmerged files) has exit code 128 and no trainer marker', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      const { result } = runAppendixCommand(ENGINE['cherry-pick'](), 'git commit -m "x"')
      expect(result!.exitCode).toBe(128)
      expect(result!.output.startsWith('[тренажёр]')).toBe(false)
      await run(user, 'git commit -m "x"')
      expect(within(log()).getByText(/Committing is not possible because you have unmerged files\./)).toBeInTheDocument()
      expect(within(log()).getAllByText(site.trainers.failedOutput, { exact: false }).length).toBeGreaterThan(0)
      framePanel()
    })

    it('a path deleted with the trash button disappears from the files but stays an unmerged path, named from the conflict view', async () => {
      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      await user.click(screen.getByRole('button', { name: `${ui.files.deleteButton}: app.js` }))
      expect(screen.queryByRole('button', { name: `${ui.files.editButton}: app.js` })).toBeNull()
      const gone = within(filesPanel()).getByText(`${cui.files.unmergedWord}, ${cui.files.unmergedGone}`)
      expect(gone.closest('li')).toHaveTextContent('app.js')
      expect(gone.closest('li')).toHaveTextContent('UU')
      expect(within(framePanel()).getByText('app.js')).toBeInTheDocument()
    })
  })

  describe('step C: area refusals and git refusals are told apart by the engine answer, the screen shows the history as it is', () => {
    const areaRefusals: [keyof typeof ENGINE, string][] = [
      ['cherry-pick', 'git rebase --quit'],
      ['cherry-pick', 'git cherry-pick --quit'],
      ['cherry-pick', 'git merge feature'],
      ['cherry-pick', 'git diff'],
      ['cherry-pick', 'git switch -c other'],
      ['cherry-pick', 'git commit --allow-empty -m "x"'],
      ['rebase', 'git merge feature'],
      ['rebase', 'git rebase --quit'],
    ]
    it.each(areaRefusals)('%s: "%s" is an area refusal (no exit code, starts with the marker) and is shown with it', async (kind, line) => {
      const user = userEvent.setup()
      renderScreen()
      await SCREEN[kind](user)
      const { result } = runAppendixCommand(ENGINE[kind](), line)
      expect(result!.exitCode).toBeUndefined()
      expect(result!.ok).toBe(false)
      expect(result!.output.startsWith('[тренажёр]')).toBe(true)
      await run(user, line)
      expect(log().textContent).toContain(result!.output)
    })

    const gitRefusals: [keyof typeof ENGINE, string][] = [
      ['cherry-pick', 'git commit -m "x"'],
      ['rebase', 'git switch feature'],
      ['rebase', 'git cherry-pick feature'],
      ['rebase', 'git stash'],
      ['rebase', 'git rebase --continue'],
    ]
    it.each(gitRefusals)('%s: "%s" is an answer of git with a number exit code, not an area refusal', async (kind, line) => {
      const user = userEvent.setup()
      renderScreen()
      await SCREEN[kind](user)
      const { result } = runAppendixCommand(ENGINE[kind](), line)
      expect(typeof result!.exitCode).toBe('number')
      expect(result!.ok).toBe(result!.exitCode === 0)
      expect(result!.output.startsWith('[тренажёр]')).toBe(false)
      await run(user, line)
      expect(log().textContent).toContain(result!.output)
    })

    it('the stop on a conflict has exit code 1 and the failed mark; the success of --continue has exit code 0 and no mark', async () => {
      const stop = ENGINE['cherry-pick']().history.at(-1)
      expect(stop?.kind === 'command' && stop.ok).toBe(false)
      expect(runAppendixCommand(engineRun(engineEdited(), ['git commit -am "master: v2"']), 'git cherry-pick feature~1').result!.exitCode).toBe(1)
      const resolved = engineRun(ENGINE['cherry-pick'](), ['git add app.js'])
      expect(runAppendixCommand(resolved, 'git cherry-pick --continue').result!.exitCode).toBe(0)

      const user = userEvent.setup()
      renderScreen()
      await cherryPickConflict(user)
      expect(within(log()).getAllByText(site.trainers.failedOutput)).toHaveLength(1)
      await user.click(bothButton())
      await runAll(user, ['git add app.js', 'git cherry-pick --continue'])
      expect(within(log()).getAllByText(site.trainers.failedOutput)).toHaveLength(1)
    })
  })

  describe('step C: stash pop and stash apply with a conflict', () => {
    it('stash pop: the frame names the stash, not an operation; the labels are Updated upstream and Stashed changes; the stash stays', async () => {
      const user = userEvent.setup()
      renderScreen()
      await stashConflict(user)
      const frame = framePanel()
      expect(within(frame).getByText(cui.frame.operationStash)).toBeInTheDocument()
      expect(within(frame).getByText(rc.stashFinish)).toBeInTheDocument()
      expect(within(frame).getByText(rc.stashAbort)).toBeInTheDocument()
      expect(within(frame).getByText('UU')).toBeInTheDocument()
      expect(keepButton('Updated upstream')).toBeInTheDocument()
      expect(keepButton('Stashed changes')).toBeInTheDocument()
      expect(screen.queryByText(cui.editor.rebaseSpeech)).toBeNull()
      expect(missionItem(3)).toHaveAttribute('data-done', 'false')
      await run(user, 'git stash list')
      expect(within(log()).getByText(/^stash@\{0\}: WIP on master:/)).toBeInTheDocument()
    })

    it('stash apply: the same frame; mission 4 is not counted', async () => {
      const user = userEvent.setup()
      renderScreen()
      await stashConflict(user, 'git stash apply')
      expect(within(framePanel()).getByText(cui.frame.operationStash)).toBeInTheDocument()
      expect(missionItem(3)).toHaveAttribute('data-done', 'false')
    })

    it('git add takes the frame away; the hint about git stash drop is the 💡 line of git add; git stash drop ends it', async () => {
      const user = userEvent.setup()
      renderScreen()
      await stashConflict(user)
      await user.click(keepButton('Stashed changes'))
      await run(user, 'git add app.js')
      frameAbsent()
      const chosen = chooseConflictPart(ENGINE.stash(), 'app.js', 'bottom')
      expect(getConflictView(engineRun(chosen, ['git add app.js']))).toBeNull()
      const added = runAppendixCommand(chosen, 'git add app.js').result!
      expect(added.explanation).toContain(rc.allAddedStash)
      expect(log().textContent).toContain(`💡 ${added.explanation}`)
      await run(user, 'git stash drop')
      expect(within(log()).getByText(/Dropped refs\/stash@\{0\}/)).toBeInTheDocument()
    })

    it('git reset --hard takes the frame and the markers away (no --abort for a stash)', async () => {
      const user = userEvent.setup()
      renderScreen()
      await stashConflict(user)
      await run(user, 'git reset --hard')
      frameAbsent()
      expect(markerLines()).toHaveLength(0)
      expect(within(filesPanel()).queryByText(cui.files.unmergedWord)).toBeNull()
    })

    it('git status in the middle of the stash conflict lists the unmerged path', async () => {
      const user = userEvent.setup()
      renderScreen()
      await stashConflict(user)
      await run(user, 'git status')
      expect(within(log()).getAllByText(/Unmerged paths:/).length).toBeGreaterThan(0)
    })

    it('mission 4 is counted for a pop without a conflict', async () => {
      const user = userEvent.setup()
      renderScreen()
      await editApp(user)
      await runAll(user, ['git stash', 'git stash pop'])
      expect(missionItem(3)).toHaveAttribute('data-done', 'true')
      frameAbsent()
    })
  })

  describe('step C: rebase with a conflict', () => {
    it('stops on a conflict: the frame names rebase, the prompt and the graph show the detached HEAD, the status header is in the log', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflict(user)
      const state = ENGINE.rebase()
      expect(state.head.kind).toBe('detached')
      expect(within(framePanel()).getByText(cui.frame.operationRebase)).toBeInTheDocument()
      expect(within(framePanel()).getByText(rc.rebaseFinish)).toBeInTheDocument()
      expect(within(framePanel()).getByText(rc.rebaseAbort)).toBeInTheDocument()
      expect(framePanel().textContent).not.toMatch(/merge/)
      expect(screen.getAllByText(ui.terminal.promptDetached(state.head.kind === 'detached' ? state.head.id.slice(0, 7) : '')).length).toBeGreaterThan(0)

      const commits = getCommits(state)
      expect(commits.some((c) => c.decorations.includes('HEAD'))).toBe(true)
      expect(commits.some((c) => c.decorations.some((d) => d.startsWith('HEAD ->')))).toBe(false)
      expect(within(graph()).getByText('HEAD')).toBeInTheDocument()
      expect(within(graph()).queryByText(/HEAD ->/)).toBeNull()
      expect(within(graph()).getByText('feature')).toBeInTheDocument()

      await run(user, 'git status')
      const header = runAppendixCommand(state, 'git status').result!.output
      expect(header).not.toMatch(/On branch/)
      expect(log().textContent).toContain(header)
      expect(within(log()).queryByText(/On branch feature/)).toBeNull()
    })

    it('shows the speech "HEAD is the new base" next to the editor buttons, with the labels of the file', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflict(user)
      expect(getConflictView(ENGINE.rebase())!.headIsNewBase).toBe(true)
      expect(screen.getByText('HEAD здесь — новая база, твой коммит — нижняя часть.')).toBeInTheDocument()
      const [file] = getConflictFiles(ENGINE.rebase())
      expect(keepButton('HEAD')).toBeInTheDocument()
      expect(keepButton(file.bottomLabel)).toBeInTheDocument()
      expect(markerLines()).toHaveLength(3)
    })

    it('does not show the speech "HEAD is the new base" on the second stop, where HEAD is the copy of the first commit', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflictOnLastCommit(user)
      expect(screen.queryByText('HEAD здесь — новая база, твой коммит — нижняя часть.')).toBeNull()
      expect(screen.queryByText(cui.editor.rebaseSpeech)).toBeNull()
    })

    it('--continue after the conflict: the final line, the frame is gone, old commits turn faded, mission 7 counts', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflict(user)
      expect(missionItem(6)).toHaveAttribute('data-done', 'false')
      await user.click(bothButton())
      await run(user, 'git add app.js')
      expect(within(framePanel()).getByText(rc.rebaseFinishAdded)).toBeInTheDocument()
      await run(user, 'git rebase --continue')
      expect(within(log()).getByText(/Successfully rebased and updated refs\/heads\/feature\./)).toBeInTheDocument()
      frameAbsent()
      expect(screen.getAllByText('(feature) $').length).toBeGreaterThan(0)
      const faded = graph().querySelectorAll('[data-faded]')
      expect(faded.length).toBeGreaterThan(0)
      expect(within(faded[0] as HTMLElement).getByText(ui.commitGraph.fadedNote, { exact: false })).toBeInTheDocument()
      expect(missionItem(6)).toHaveAttribute('data-done', 'true')
    })

    it('--skip after the conflict counts mission 7 too', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflict(user)
      await run(user, 'git rebase --skip')
      frameAbsent()
      expect(missionItem(6)).toHaveAttribute('data-done', 'true')
    })

    it('--abort does not count mission 7, brings HEAD back to the branch and removes the frame', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflict(user)
      await run(user, 'git rebase --abort')
      frameAbsent()
      expect(markerLines()).toHaveLength(0)
      expect(screen.getAllByText('(feature) $').length).toBeGreaterThan(0)
      expect(missionItem(6)).toHaveAttribute('data-done', 'false')
    })

    it('--abort after a stop on the last commit turns the copies made before it faded', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflictOnLastCommit(user)
      expect(within(framePanel()).getByText('AA')).toBeInTheDocument()
      expect(within(framePanel()).getByText(rc.kindBothAdded, { exact: false })).toBeInTheDocument()
      expect(within(filesPanel()).getByText('AA')).toBeInTheDocument()
      expect(graph().querySelector('[data-faded]')).toBeNull()
      await run(user, 'git rebase --abort')
      frameAbsent()
      expect(graph().querySelectorAll('[data-faded]').length).toBeGreaterThan(0)
    })

    it('git add of every path and then git reset --hard leave the rebase going: the frame still names the finishing command', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflict(user)
      await user.click(bothButton())
      await run(user, 'git add app.js')
      await run(user, 'git reset --hard')
      expect(within(framePanel()).getByText(rc.rebaseFinishAdded)).toBeInTheDocument()
    })
  })

  describe('step C: the section starts over', () => {
    it('removes the unmerged paths, the operation, the frame and the faded commits and zeroes the missions', async () => {
      const user = userEvent.setup()
      renderScreen()
      await rebaseConflictOnLastCommit(user)
      await run(user, 'git rebase --abort')
      await run(user, 'git tag v1.0.0')
      await rebaseConflict(user)
      await user.click(screen.getByRole('button', { name: ui.resetButton }))

      frameAbsent()
      expect(markerLines()).toHaveLength(0)
      expect(within(filesPanel()).queryByText(cui.files.unmergedWord)).toBeNull()
      expect(graph().querySelector('[data-faded]')).toBeNull()
      expect(doneCount()).toBe(0)
      expect(screen.getByText('(master) $')).toBeInTheDocument()
      expect(within(filesPanel()).getAllByRole('listitem')).toHaveLength(getWorkingFiles(initial()).length)
    })
  })

  describe('step C: texts', () => {
    it('the intro tells about the conflicts, the editor buttons and --continue, --skip, --abort', () => {
      expect(ui.intro).toMatch(/конфликт/)
      expect(ui.intro).toMatch(/--continue/)
      expect(ui.intro).toMatch(/--skip/)
      expect(ui.intro).toMatch(/--abort/)
      expect(ui.intro).toMatch(/кнопк/)
    })

    it('the screen dictionary has no leftovers of "step B" or "not yet"', () => {
      const text = JSON.stringify([ui, cui], (_k, v) => (typeof v === 'function' ? v('x') : v))
      expect(text).not.toMatch(/шаг B|шаг A|пока нет|конфликты не разбираются/)
    })

    it('has no frame and no editor buttons without a conflict', () => {
      renderScreen()
      frameAbsent()
      expect(screen.queryByRole('group')).toBeNull()
    })
  })

  it('has no user strings of its own', () => {
    // Every visible string comes from the dictionary: no Cyrillic literals in the screen source.
    expect(source.replace(/\/\/.*$/gm, '')).not.toMatch(/[А-Яа-яЁё]/)
  })
})
