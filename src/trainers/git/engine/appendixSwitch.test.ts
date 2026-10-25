// Переходы HEAD: git checkout и git switch (target.md, часть XII). Блоки протокола проигрываются на движке:
// вывод и код возврата каждой команды сверяются с настоящим git 2.53.0 (appendixProtocolKit.ts).
import { describe, expect, it } from 'vitest'
import { currentCommitId } from './appendixRepo'
import { fresh, protocolBlock, protocolEntry, replayBlock, run, runAll, where, type ReplayOptions } from './appendixProtocolKit'
import { editAppendixFile, type AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const seed = ru.appendix.seed
const ax = ru.appendix.explain
const idOf = (state: AppendixState, message: string) => Object.values(state.commits).find((c) => c.message === message)!.id
/** Шаги сценария: `edit <файл>` — кнопка ✎, остальное — команды git. */
const play = (state: AppendixState, steps: readonly string[]): AppendixState =>
  steps.reduce((s, step) => (step.startsWith('edit ') ? editAppendixFile(s, step.slice('edit '.length)) : run(s, step).state), state)
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)

function expectReplay(block: string | readonly string[], options: ReplayOptions = {}): void {
  const replay = replayBlock(block, options)
  const problems = replay.steps.filter((s) => s.mismatch !== null).map((s) => `${s.entry.file}:${s.entry.line} «${s.entry.command}» — ${s.mismatch}`)
  expect(problems).toEqual([])
  expect(replay.steps.length).toBeGreaterThan(0)
}

describe('блоки протокола П8.57–П8.68 проигрываются на движке', () => {
  it('П8.57: checkout HEAD с ветки и из отсоединённого HEAD, --detach HEAD', () => expectReplay('П8.57'))
  it('П8.58: refs/heads/<ветка>, tags/<тег>, отказы switch', () =>
    expectReplay('П8.58', { refused: (e) => e.command === 'git switch refs/heads/master' || e.command === 'git switch HEAD' }))
  it('П8.59: переход на предка брошенного коммита', () => expectReplay('П8.59'))
  it('П8.60: switch --detach, -, -c, ошибки', () => expectReplay('П8.60', { refused: (e) => e.command === 'git switch HEAD' || e.command === 'git switch -c y z' }))
  it('П8.61: HEAD@{n}', () => expectReplay('П8.61', { refused: (e) => e.command === 'git checkout HEAD@{010}' || e.command === 'git show HEAD@{-1}' }))
  it('П8.62: branch -d и -D', () => expectReplay('П8.62'))
  it('П8.63: branch -d, несколько имён', () => expectReplay('П8.63'))
  it('П8.64: правка при switch и checkout -b', () => expectReplay('П8.64'))
  it('П8.65: отказ из-за правки, - при удалённой ветке', () =>
    expectReplay('П8.65', { refused: (e) => e.command === 'git checkout --detach feature master' || e.command === 'git checkout -b x y z' }))
  it('П8.66: ссылка, которой нет', () => expectReplay('П8.66', { refused: (e) => e.command === 'git switch -c x master' }))
  it('П8.67: тот же коммит через --detach, switch с HEAD@{n} и id', () => expectReplay('П8.67'))
  it('П8.68: switch на коммит при правке', () => expectReplay('П8.68'))

  it('в протоколе есть все блоки П8.57–П8.68', () => {
    for (let n = 57; n <= 68; n++) expect(protocolBlock(`П8.${n}`).length, `П8.${n}`).toBeGreaterThan(0)
  })
})

// Снято вне терминала: `M\t<файл>` в О7 и О16 стоит после остальных строк. Тренажёр показывает порядок терминала (О24).
const flushedLast = (e: { command: string; output: string }) => /^M\t/m.test(e.output) && !e.output.startsWith('M\t')

describe('блоки протокола О1–О25 (detached-head-git-runs.txt) проигрываются на движке', () => {
  const noReflogShow = (e: { command: string }) => e.command.startsWith('git reflog show')
  it('О1–О5: вход, повторный checkout, соседний коммит, два брошенных коммита, 5–6 коммитов и усечение, тег, checkout -b и switch -c', () =>
    expectReplay(['О1', 'О2', 'О3', 'О4', 'О5'], { refused: (e) => noReflogShow(e) || e.command.includes('--graph') }))
  it('О7: checkout с правками (порядок строк как на терминале)', () => expectReplay('О7', { unordered: flushedLast }))
  it('О8: checkout - и switch -', () => expectReplay('О8'))
  it('О11 до origin/master: аннотированный тег, status, branch, reflog', () => {
    expectReplay('О11', { until: protocolBlock('О11').findIndex((e) => e.command.startsWith('git update-ref')) })
  })
  it('О12–О17: tags/<тег>, тот же коммит под другим именем, checkout -, X после tag -f и tag -d, правка при переходе, switch <тег>', () => {
    expectReplay(['О12', 'О13', 'О14', 'О15', 'О16', 'О17'], { unordered: flushedLast })
  })
  it('О19: stash -m в отсоединённом HEAD', () => expectReplay('О19'))
  it('О22–О23: семь брошенных коммитов, checkout HEAD@{n}, checkout --detach без ссылки', () => expectReplay(['О22', 'О23']))
  it('О25: stash -m и stash pop в отсоединённом HEAD', () => expectReplay('О25'))
})

describe('вход в отсоединённый HEAD: формы, запись журнала, lastCheckout', () => {
  const start = runAll(fresh(), ['git tag v1.0.0 HEAD~1', 'git tag -a va -m "аннотация" feature~1'])
  const base = idOf(start, seed.baseMessage)
  const fix = idOf(start, seed.fixMessage)
  const about = idOf(start, seed.aboutMessage)
  const cases: [string, string, string][] = [
    // команда, как набрано в журнале, коммит
    ['git checkout v1.0.0', 'v1.0.0', base],
    ['git checkout tags/v1.0.0', 'tags/v1.0.0', base],
    ['git checkout va', 'va', fix],
    ['git checkout tags/va', 'tags/va', fix],
    [`git checkout ${base.slice(0, 7)}`, base.slice(0, 7), base],
    [`git checkout ${base}`, base, base],
    ['git checkout HEAD~1', 'HEAD~1', base],
    ['git checkout master~1', 'master~1', base],
    ['git checkout feature~1', 'feature~1', fix],
    ['git checkout HEAD@{1}', 'HEAD@{1}', base],
    ['git checkout refs/heads/feature', 'refs/heads/feature', about],
    ['git checkout --detach feature', 'feature', about],
    ['git checkout --detach', 'HEAD', idOf(start, seed.readmeMessage)],
    ['git switch --detach feature~1', 'feature~1', fix],
    ['git switch --detach', 'HEAD', idOf(start, seed.readmeMessage)],
  ]
  for (const [command, spec, id] of cases) {
    it(`${command}: HEAD на коммите, ветки и теги на месте, журнал «moving from master to ${spec}» (${where('П8.15', 'git checkout v1.0.0')}, ${where('О23', 'git checkout --detach')})`, () => {
      const r = run(start, command)
      expect(r.result).toMatchObject({ ok: true, exitCode: 0 })
      expect(r.state.head).toEqual({ kind: 'detached', id })
      expect(r.state.branches).toEqual(start.branches)
      expect(r.state.tags).toEqual(start.tags)
      expect(r.state.reflog[0]).toEqual({ id, message: `checkout: moving from master to ${spec}` })
      expect(r.state.reflog).toHaveLength(start.reflog.length + 1)
      expect(r.state.lastCheckout).toEqual({ spec, id })
      expect(r.state.history).toHaveLength(start.history.length + 1)
    })
  }

  it(`checkout без --detach печатает блок Note с тем, что набрано; с --detach — только HEAD is now at (${where('О1', 'git checkout HEAD~1')}, ${where('О1', 'git switch --detach master~1')})`, () => {
    const withNote = run(start, 'git checkout HEAD~1').result.output
    expect(withNote.startsWith("Note: switching to 'HEAD~1'.\n\nYou are in 'detached HEAD' state.")).toBe(true)
    expect(withNote.endsWith(`\nHEAD is now at ${base.slice(0, 7)} ${seed.baseMessage}`)).toBe(true)
    expect(run(start, 'git checkout --detach HEAD~1').result.output).toBe(`HEAD is now at ${base.slice(0, 7)} ${seed.baseMessage}`)
    expect(run(start, 'git switch --detach HEAD~1').result.output).toBe(`HEAD is now at ${base.slice(0, 7)} ${seed.baseMessage}`)
  })

  it(`блок Note дословно совпадает с протоколом (${where('О1', 'git checkout HEAD~1')})`, () => {
    const real = protocolEntry('О1', 'git checkout HEAD~1').output
    const ours = run(start, 'git checkout HEAD~1').result.output
    expect(ours.replace(/[0-9a-f]{7}/, '<id7>')).toBe(real.replace(/[0-9a-f]{7}/, '<id7>'))
  })

  it('git checkout -, когда прошлое место — коммит: Note с полным id, запись «to <полный id>» (О14, О8)', () => {
    const away = runAll(start, ['git checkout v1.0.0', 'git checkout master'])
    const r = run(away, 'git checkout -')
    expect(r.result.output.startsWith(`Note: switching to '${base}'.`)).toBe(true)
    expect(r.state.head).toEqual({ kind: 'detached', id: base })
    expect(r.state.reflog[0].message).toBe(`checkout: moving from master to ${base}`)
    expect(r.state.lastCheckout).toEqual({ spec: base, id: base })
  })

  it('переход с коммита на другой коммит: запись «moving from <полный id> to <как набрано>» (О1)', () => {
    const r = run(runAll(start, ['git checkout v1.0.0']), 'git checkout feature~1')
    expect(r.state.reflog[0].message).toBe(`checkout: moving from ${base} to feature~1`)
    expect(r.result.output).toBe(`Previous HEAD position was ${base.slice(0, 7)} ${seed.baseMessage}\nHEAD is now at ${fix.slice(0, 7)} ${seed.fixMessage}`)
  })
})

describe('git checkout HEAD и тот же коммит', () => {
  const start = fresh()

  it(`с ветки: пустой вывод, HEAD остаётся на ветке, журнал и lastCheckout не меняются (${where('П8.57', 'git checkout HEAD')})`, () => {
    const r = run(start, 'git checkout HEAD')
    expect(r.result).toMatchObject({ ok: true, output: '', exitCode: 0 })
    expect(r.state.head).toEqual({ kind: 'branch', name: 'master' })
    expect(r.state.reflog).toEqual(start.reflog)
    expect(r.state.lastCheckout).toEqual(start.lastCheckout)
  })

  it(`с ветки при правке: печатает только M\t<файл>, правка остаётся (${where('П8.57', 'git checkout HEAD', 1)})`, () => {
    const edited = runAll(start, ['git checkout HEAD']).working['app.js']
    const dirty = { ...start, working: { ...start.working, 'app.js': `${edited} + правка` } }
    const r = run(dirty, 'git checkout HEAD')
    expect(r.result.output).toBe('M\tapp.js')
    expect(r.state.working['app.js']).toBe(dirty.working['app.js'])
    expect(r.state.head).toEqual(dirty.head)
  })

  it(`git checkout --detach HEAD с ветки отсоединяет HEAD и пишет «moving from master to HEAD» (${where('П8.57', 'git checkout --detach HEAD')})`, () => {
    const r = run(start, 'git checkout --detach HEAD')
    expect(r.state.head).toEqual({ kind: 'detached', id: currentCommitId(start) })
    expect(r.state.reflog[0].message).toBe('checkout: moving from master to HEAD')
  })

  it(`из отсоединённого HEAD: checkout HEAD молчит, --detach печатает HEAD is now at, записей в журнал нет (${where('П8.57', 'git checkout HEAD', 2)}, ${where('П8.67', 'git checkout --detach')})`, () => {
    const detached = runAll(start, ['git checkout --detach'])
    const quiet = run(detached, 'git checkout HEAD')
    expect(quiet.result.output).toBe('')
    expect(quiet.state.reflog).toEqual(detached.reflog)
    const again = run(detached, 'git checkout --detach')
    expect(again.result.output).toBe(`HEAD is now at ${currentCommitId(start).slice(0, 7)} ${seed.readmeMessage}`)
    expect(again.state.reflog).toEqual(detached.reflog)
    expect(again.state.lastCheckout).toEqual(detached.lastCheckout)
  })
})

describe('git switch', () => {
  const start = runAll(fresh(), ['git tag v2.0 master~1', 'git tag -a va -m "аннотация" master~1'])
  const base = idOf(start, seed.baseMessage)

  it(`на коммит и тег без --detach — отказ git, код 128, HEAD, журнал и деревья на месте (${where('О1', 'git switch HEAD~1')}, ${where('О17', 'git switch v2.0')})`, () => {
    for (const [command, kind, word] of [
      ['git switch HEAD~1', 'commit', 'HEAD~1'],
      ['git switch master~1', 'commit', 'master~1'],
      [`git switch ${base.slice(0, 7)}`, 'commit', base.slice(0, 7)],
      ['git switch HEAD@{1}', 'commit', 'HEAD@{1}'],
      ['git switch v2.0', 'tag', 'v2.0'],
      ['git switch va', 'tag', 'va'],
      // git называет в отказе имя тега без «tags/» (П8.58)
      ['git switch tags/v2.0', 'tag', 'v2.0'],
      ['git switch tags/va', 'tag', 'va'],
    ] as const) {
      const r = run(start, command)
      expect(r.result.exitCode, command).toBe(128)
      expect(r.result.ok).toBe(false)
      expect(r.result.output, command).toBe(
        `fatal: a branch is expected, got ${kind} '${word}'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.`,
      )
      expect(r.result.explanation).toBe(ax.switchBranchExpected)
      expect({ head: r.state.head, reflog: r.state.reflog, index: r.state.index, working: r.state.working }).toEqual({ head: start.head, reflog: start.reflog, index: start.index, working: start.working })
    }
    expect(protocolEntry('О1', 'git switch HEAD~1').exitCode).toBe(128)
    expect(protocolEntry('О17', 'git switch v2.0').exitCode).toBe(128)
  })

  it('отказ «нужна ветка» идёт раньше проверки правок (П8.68)', () => {
    const dirty = { ...start, working: { ...start.working, 'README.md': '# Мини-сайт\n + правка\n' } }
    const r = run(dirty, 'git switch master~1')
    expect(r.result.exitCode).toBe(128)
    expect(r.result.output.startsWith('fatal: a branch is expected')).toBe(true)
    expect(run(dirty, 'git switch --detach master~1').result.exitCode).toBe(1)
    expect(protocolBlock('П8.68').map((e) => e.exitCode)).toEqual([0, 128, 1, 0])
  })

  it('HEAD и refs/heads/<ветка> без --detach: git называет их в отказе по-особому — отказ области, HEAD на месте (П8.58)', () => {
    for (const word of ['HEAD', 'refs/heads/feature']) {
      const r = run(start, `git switch ${word}`)
      refusal(r.result.output)
      expect(r.result.exitCode).toBeUndefined()
      expect(r.state.head).toEqual(start.head)
    }
  })

  it(`ветка: Switched to branch, запись «moving from master to feature»; та же ветка — Already on, запись тоже есть (${where('П8.64', 'git switch master')})`, () => {
    const r = run(start, 'git switch feature')
    expect(r.result.output).toBe("Switched to branch 'feature'")
    expect(r.state.head).toEqual({ kind: 'branch', name: 'feature' })
    expect(r.state.reflog[0]).toEqual({ id: start.branches.feature, message: 'checkout: moving from master to feature' })
    expect(run(start, 'git switch master').result.output).toBe("Already on 'master'")
  })

  it(`-c: новая ветка на HEAD и переход на неё; с коммита — запись «moving from <полный id> to <имя>» (${where('О5', 'git switch -c exp2')})`, () => {
    const detached = runAll(start, ['git checkout --detach master~1'])
    const r = run(detached, 'git switch -c exp2')
    expect(r.result.output).toBe("Switched to a new branch 'exp2'")
    expect(r.state.branches.exp2).toBe(base)
    expect(r.state.head).toEqual({ kind: 'branch', name: 'exp2' })
    expect(r.state.reflog[0].message).toBe(`checkout: moving from ${base} to exp2`)
    expect(r.state.lastCheckout).toEqual({ spec: 'exp2', id: base })
    expect(r.result.explanation).toBe(ax.detachedBranchCreated('exp2'))
  })

  it(`ошибки формы: без аргументов, лишний аргумент, -c без значения, --detach вместе с -c, несуществующая ссылка (${where('П8.60', 'git switch -c')}, ${where('П8.66', 'git switch nosuch')})`, () => {
    const code = (command: string) => run(start, command).result
    expect(code('git switch')).toMatchObject({ output: 'fatal: missing branch or commit argument', exitCode: 128 })
    expect(code('git switch master extra')).toMatchObject({ output: 'fatal: only one reference expected', exitCode: 128 })
    expect(code('git switch --detach master extra')).toMatchObject({ output: 'fatal: only one reference expected', exitCode: 128 })
    expect(code('git switch -c')).toMatchObject({ output: "error: switch `c' requires a value", exitCode: 129 })
    expect(code('git switch --detach -c x')).toMatchObject({ output: "fatal: '--detach' cannot be used with '-b/-B/--orphan'", exitCode: 128 })
    expect(code('git switch nosuch')).toMatchObject({ output: 'fatal: invalid reference: nosuch', exitCode: 128 })
    expect(code('git switch --detach master~9')).toMatchObject({ output: 'fatal: invalid reference: master~9', exitCode: 128 })
    expect(code('git switch -c master')).toMatchObject({ output: "fatal: a branch named 'master' already exists", exitCode: 128 })
    expect(code('git switch -c "a b"').exitCode).toBe(128)
    expect(code('git switch -c "a b"').output.startsWith("fatal: 'a b' is not a valid branch name")).toBe(true)
  })

  it('ключи и формы вне области — отказ области: -C, -t, -f, начальная точка у -c, --, ссылка вне грамматики', () => {
    for (const command of ['git switch -C x', 'git switch -f master', 'git switch -t origin/x', 'git switch -c x master', 'git switch --detach -', 'git switch -- master', 'git switch HEAD@{1}~1', 'git switch master..feature', 'git switch -c -x']) {
      const r = run(start, command)
      refusal(r.result.output)
      expect(r.result.exitCode, command).toBeUndefined()
      expect(r.state.head, command).toEqual(start.head)
    }
  })

  it('git switch - возвращает на прошлую ветку; прошлое место — коммит: отказ с полным id; прошлая ветка удалена: ошибки git двух команд (О8, П8.65)', () => {
    const back = runAll(start, ['git switch feature'])
    expect(run(back, 'git switch -').result.output).toBe("Switched to branch 'master'")
    const fromCommit = runAll(start, ['git checkout master~1', 'git checkout master'])
    const refused = run(fromCommit, 'git switch -').result
    expect(refused).toMatchObject({ exitCode: 128 })
    expect(refused.output.startsWith(`fatal: a branch is expected, got commit '${base}'`)).toBe(true)
    expect(run(fromCommit, 'git checkout -').result.output.startsWith(`Note: switching to '${base}'.`)).toBe(true)
    const gone = runAll(start, ['git switch feature', 'git switch master', 'git branch -D feature'])
    expect(run(gone, 'git switch -').result).toMatchObject({ output: 'fatal: invalid reference: @{-1}', exitCode: 128 })
    expect(run(gone, 'git checkout -').result).toMatchObject({ output: "error: pathspec '-' did not match any file(s) known to git", exitCode: 1 })
  })
})

describe('порядок файлов в отчёте перехода: байты UTF-8, а не кодовые единицы UTF-16', () => {
  it('M\t<файл> для U+FF21 (байты EF BC A1) идёт раньше U+1F600 (байты F0 9F 98 80), хотя в UTF-16 суррогат D83D меньше FF21', () => {
    const wide = '\uFF21.txt'
    const smile = '\u{1F600}.txt'
    let s = fresh()
    // Два файла в коммите, затем ещё один коммит: переход на master~1 оставляет их, правка в них переезжает.
    s = { ...s, working: { ...s.working, [smile]: 'x\n', [wide]: 'y\n' } }
    s = run(run(s, `git add ${smile}`).state, `git add ${wide}`).state
    s = run(s, 'git commit -m "wide"').state
    s = run(run(editAppendixFile(s, 'app.js'), 'git add app.js').state, 'git commit -m "second"').state
    s = { ...s, working: { ...s.working, [smile]: 'x2\n', [wide]: 'y2\n' } }
    const r = run(s, 'git checkout master~1')
    expect(r.result.exitCode).toBe(0)
    const lines = r.result.output.split('\n').filter((l) => l.startsWith('M\t') || l.startsWith('A\t') || l.startsWith('D\t'))
    expect(lines).toEqual([`M\t${wide}`, `M\t${smile}`])
  })
})

describe('переход с правкой в рабочем каталоге (О7, О16, О24, П8.64, П8.65)', () => {
  const edited = (state: AppendixState, file: string): AppendixState => ({ ...state, working: { ...state.working, [file]: `${state.working[file].replace(/\n$/, '')} + правка\n` } })
  const start = fresh()

  it(`правка файла, который переход не меняет, переезжает: M\t<файл> первой строкой, потом блок Note и HEAD is now at (${where('О24', 'echo x >> app.js; stdbuf -oL -eL git checkout master~1 2>&1 | cat')})`, () => {
    const dirty = edited(start, 'app.js')
    const r = run(dirty, 'git checkout master~1')
    expect(r.result.exitCode).toBe(0)
    expect(r.result.output.split('\n')[0]).toBe('M\tapp.js')
    expect(r.result.output.split('\n')[1]).toBe("Note: switching to 'master~1'.")
    expect(r.result.explanation).toContain(ax.carriedFiles)
    expect(r.state.working['app.js']).toBe(dirty.working['app.js'])
    expect(r.state.head.kind).toBe('detached')
    // и обратно: с коммита на ветку M\t<файл> тоже первая, затем Previous HEAD position
    const back = run(r.state, 'git checkout master')
    expect(back.result.output).toBe(`M\tapp.js\nPrevious HEAD position was ${currentCommitId(start) === '' ? '' : idOf(start, seed.baseMessage).slice(0, 7)} ${seed.baseMessage}\nSwitched to branch 'master'`)
  })

  it(`правка файла, который переход затёр бы, мешает в обе стороны: код 1, HEAD, журнал и правка на месте (${where('О7', 'echo dirty >> README.md; git checkout master~1')}, ${where('О16', 'echo x >> app.js; git checkout master')})`, () => {
    const dirty = edited(start, 'README.md')
    for (const command of ['git checkout master~1', 'git switch --detach master~1', 'git checkout --detach feature']) {
      const r = run(dirty, command)
      expect(r.result.exitCode, command).toBe(1)
      expect(r.result.output, command).toBe(
        `error: Your local changes to the following files would be overwritten by checkout:\n\tREADME.md\nPlease commit your changes or stash them before you switch branches.\nAborting`,
      )
      expect(r.result.explanation).toBe(ax.checkoutRefusedEdit)
      expect({ head: r.state.head, reflog: r.state.reflog, working: r.state.working }).toEqual({ head: dirty.head, reflog: dirty.reflog, working: dirty.working })
    }
    const onCommit = runAll(start, ['git checkout --detach feature~1'])
    const dirtyThere = edited(onCommit, 'app.js')
    const back = run(dirtyThere, 'git checkout master')
    expect(back.result.exitCode).toBe(1)
    expect(back.result.output).toContain('\tapp.js')
    expect(back.state.head).toEqual(dirtyThere.head)
    expect(run(dirtyThere, 'git switch master').result.exitCode).toBe(1)
  })

  it(`checkout -b и switch -c перенос не перечисляют (${where('П8.64', 'git checkout -b nb2')})`, () => {
    const dirty = edited(start, 'app.js')
    expect(run(dirty, 'git checkout -b nb').result.output).toBe("Switched to a new branch 'nb'")
    expect(run(dirty, 'git switch -c nb').result.output).toBe("Switched to a new branch 'nb'")
    expect(run(dirty, 'git switch -c nb').state.working).toEqual(dirty.working)
  })
})

describe('брошенные коммиты и три пути их вернуть (О3, О4, О22, П8.59)', () => {
  const detachedWithTwo = play(fresh(), ['git checkout --detach master', 'edit app.js', 'git commit -am "Опыт 1"', 'edit app.js', 'git commit -am "Опыт 2"'])
  const [tip, first] = [currentCommitId(detachedWithTwo), detachedWithTwo.commits[currentCommitId(detachedWithTwo)].parents[0]]

  it('уход на ветку: предупреждение leaving 2 commits; речь называет три пути (О3)', () => {
    const r = run(detachedWithTwo, 'git checkout master')
    expect(r.result.output).toContain('Warning: you are leaving 2 commits behind, not connected to')
    expect(r.result.output).toContain(` git branch <new-branch-name> ${tip.slice(0, 7)}`)
    expect(r.result.explanation).toBe(ax.leavingBehind(2, tip.slice(0, 7)))
    expect(r.result.explanation).toContain('git switch -c')
    expect(r.result.explanation).toContain('git reflog')
    expect(r.result.explanation).toContain(`git branch имя ${tip.slice(0, 7)}`)
  })

  it('переход на предка брошенного коммита: предупреждение только о тех, что выше нового места (П8.59)', () => {
    const r = run(detachedWithTwo, 'git checkout HEAD~1')
    expect(r.result.output).toContain('Warning: you are leaving 1 commit behind')
    expect(r.result.output).toContain(`  ${tip.slice(0, 7)} Опыт 2`)
    expect(r.result.output).not.toContain(`  ${first.slice(0, 7)} Опыт 1`)
    expect(r.result.output.endsWith(`HEAD is now at ${first.slice(0, 7)} Опыт 1`)).toBe(true)
  })

  it('тег на брошенном коммите гасит предупреждение: Previous HEAD position (О4)', () => {
    const tagged = runAll(detachedWithTwo, ['git tag keep'])
    const r = run(tagged, 'git checkout master')
    expect(r.result.output).toBe(`Previous HEAD position was ${tip.slice(0, 7)} Опыт 2\nSwitched to branch 'master'`)
    expect(r.result.explanation).toBe(`${ax.previousPosition}`)
  })

  it('git checkout -b <имя> в отсоединённом HEAD оставляет коммиты на ветке: потом предупреждения нет (О5)', () => {
    const saved = runAll(detachedWithTwo, ['git checkout -b rescue'])
    expect(saved.branches.rescue).toBe(tip)
    expect(saved.head).toEqual({ kind: 'branch', name: 'rescue' })
    expect(run(saved, 'git checkout master').result.output).toBe("Switched to branch 'master'")
  })

  it('git branch <имя> <id7> из подсказки git и git branch rescue HEAD@{1} через журнал ставят ветку на брошенный коммит (О3)', () => {
    const left = runAll(detachedWithTwo, ['git checkout master'])
    const byId = run(left, `git branch rescue ${tip.slice(0, 7)}`)
    expect(byId.state.branches.rescue).toBe(tip)
    const byLog = run(left, 'git branch rescue HEAD@{1}')
    expect(byLog.state.branches.rescue).toBe(tip)
    expect(byLog.result.output).toBe('')
    expect(byLog.state.reflog).toEqual(left.reflog)
  })
})

describe('команды в отсоединённом HEAD (О3, О19, О25, П8.19)', () => {
  const detached = runAll(fresh(), ['git checkout --detach master'])
  const head7 = currentCommitId(detached).slice(0, 7)

  it(`commit: [detached HEAD <id7>], двигается только HEAD, запись «commit: <тема>», lastCheckout прежнее (${where('О3', 'echo b >> app.js; git commit -am "Эксперимент 2"')})`, () => {
    const r = run(play(detached, ['edit app.js']), 'git commit -am "Опыт"')
    expect(r.result.output).toMatch(/^\[detached HEAD [0-9a-f]{7}\] Опыт$/)
    expect(r.result.explanation).toContain(ax.commitDetached)
    expect(r.state.branches).toEqual(detached.branches)
    expect(r.state.head).toEqual({ kind: 'detached', id: r.state.reflog[0].id })
    expect(r.state.reflog[0].message).toBe('commit: Опыт')
    expect(r.state.lastCheckout).toEqual(detached.lastCheckout)
  })

  it('status: at, после коммита from; полное имя ветки и потерянное имя поясняются (О2, О18, О15)', () => {
    expect(run(detached, 'git status').result.output.split('\n')[0]).toBe('HEAD detached at refs/heads/master')
    expect(run(detached, 'git status').result.explanation).toBe(`${ax.statusDetachedAt} ${ax.statusRefsHeads}`)
    const committed = play(detached, ['edit app.js', 'git commit -am "Опыт"'])
    expect(run(committed, 'git status').result.output.split('\n')[0]).toBe('HEAD detached from refs/heads/master')
    expect(run(committed, 'git status').result.explanation).toBe(`${ax.statusDetachedFrom} ${ax.statusRefsHeads}`)
    const tagged = runAll(fresh(), ['git tag t1 master~1', 'git checkout t1'])
    expect(run(tagged, 'git status').result.output.split('\n')[0]).toBe('HEAD detached at t1')
    const moved = runAll(tagged, ['git tag -f t1 master'])
    expect(run(moved, 'git status').result.output.split('\n')[0]).toBe(`HEAD detached at ${idOf(moved, seed.baseMessage).slice(0, 7)}`)
    expect(run(moved, 'git status').result.explanation).toBe(`${ax.statusDetachedAt} ${ax.statusNameLost}`)
  })

  it('branch: первая строка * (HEAD detached at <X>), звёздочки у веток нет (О1, О2)', () => {
    const r = run(detached, 'git branch')
    expect(r.result.output).toBe('* (HEAD detached at refs/heads/master)\n  feature\n  master')
    expect(r.result.explanation).toBe(ax.branchListDetached)
  })

  it('branch <имя> [<ссылка>], tag, stash: HEAD остаётся отсоединённым, журнал не растёт, stash пишет (no branch) (О3, О5, О19, П8.19)', () => {
    const made = play(detached, ['git branch here', 'git tag v-detached', 'edit app.js'])
    expect(made.head).toEqual(detached.head)
    expect(made.branches.here).toBe(currentCommitId(detached))
    expect(made.reflog).toEqual(detached.reflog)
    const stashed = run(made, 'git stash -m "с сообщением"')
    expect(stashed.result.output).toBe('Saved working directory and index state On (no branch): с сообщением')
    expect(stashed.result.explanation).toContain(ax.stashNoBranch)
    expect(stashed.state.reflog).toEqual(detached.reflog)
    expect(run(play(made, ['git stash']), 'git stash list').result.output).toBe(`stash@{0}: WIP on (no branch): ${head7} ${seed.readmeMessage}`)
  })

  it('log и show: подпись начинается с HEAD без стрелки, ветка на том же коммите в ней есть (О2); git log идёт от HEAD и говорит об этом (опасное место 12)', () => {
    const r = run(detached, 'git log --oneline -1')
    expect(r.result.output).toBe(`${head7} (HEAD, master) ${seed.readmeMessage}`)
    expect(r.result.explanation).toBe(ax.logDetached)
    expect(run(detached, 'git log --oneline --all').result.explanation).toBeNull()
    expect(run(detached, 'git show').result.output.split('\n')[0]).toBe(`commit ${currentCommitId(detached)} (HEAD, master)`)
  })

  it('merge и pull в отсоединённом HEAD — отказ области, речь называет, что сделал бы git (О6)', () => {
    for (const command of ['git merge feature', 'git pull']) {
      const r = run(detached, command)
      refusal(r.result.output)
      expect(r.result.output).toContain('отсоединённом HEAD')
      expect(r.state).toEqual({ ...detached, history: r.state.history })
    }
    expect(run(fresh(), 'git merge feature').result.output).toBe(ru.appendix.errors.commandOutOfScope('merge'))
  })
})

describe('команды переходов ничего не бросают, в любом положении HEAD', () => {
  const forms = [
    'git checkout', 'git checkout -', 'git checkout --', 'git checkout --detach', 'git checkout --detach --detach', 'git checkout --detach master -- x', 'git checkout HEAD HEAD',
    'git checkout HEAD@{0}', 'git checkout HEAD@{99}', 'git checkout tags/', 'git checkout tags/nosuch', 'git checkout refs/heads/nosuch', 'git checkout -b', 'git checkout -b a b',
    'git checkout -b ""', 'git checkout -b HEAD', 'git checkout -b -x', 'git checkout feature --detach', 'git checkout - -',
    'git switch', 'git switch -', 'git switch - -', 'git switch --detach', 'git switch --detach -', 'git switch --detach --detach', 'git switch -c', 'git switch -c ""', 'git switch -c HEAD',
    'git switch -c a --detach', 'git switch -c a b', 'git switch --', 'git switch -- master', 'git switch ""', 'git switch HEAD@{0}', 'git switch tags/nosuch',
    'git branch -d', 'git branch -D', 'git branch -d ""', 'git branch -d HEAD', 'git branch -d -- -x', 'git branch -d master master', 'git reflog', 'git reflog x', 'git reflog ""',
  ]
  const states: [string, AppendixState][] = [
    ['на ветке', fresh()],
    ['на коммите', runAll(fresh(), ['git checkout --detach feature~1'])],
    ['после удаления ветки', runAll(fresh(), ['git branch -D feature'])],
  ]
  for (const [name, state] of states) {
    it(`${name}: каждая форма даёт результат; отказ области без кода возврата, ответ git с кодом`, () => {
      for (const command of forms) {
        const r = run(state, command)
        expect(typeof r.result.output, command).toBe('string')
        if (r.result.exitCode === undefined) expect(r.result.output.startsWith('[тренажёр]'), `${command}: ${r.result.output}`).toBe(true)
        expect(r.result.ok, command).toBe(r.result.exitCode === 0)
      }
    })
  }
})
