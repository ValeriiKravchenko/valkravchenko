// git reset (target.md, часть X, места 14 и 15, «Миссии»; часть XII, «Команды в отсоединённом HEAD», «reflog: записи»).
// Блоки протокола проигрываются на движке: вывод и код возврата каждой команды сверяются с настоящим git 2.53.0
// (appendixProtocolKit.ts). Новые прогоны лежат в appendix-g18g2-git-runs.txt (П8.69–П8.74, П8.81).
import { describe, expect, it } from 'vitest'
import { compareOutputs, fresh, protocolEntry, replayBlock, run, runAll, where, type IdMap } from './appendixProtocolKit'
import { editAppendixFile, getAppendixMissions, getCommits, type AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const ax = ru.appendix.explain
const ae = ru.appendix.errors
const idOf = (state: AppendixState, message: string) => Object.values(state.commits).find((c) => c.message === message)!.id
const readme = (state: AppendixState) => idOf(state, ru.appendix.seed.readmeMessage)
const base = (state: AppendixState) => idOf(state, ru.appendix.seed.baseMessage)
const fix = (state: AppendixState) => idOf(state, ru.appendix.seed.fixMessage)
const about = (state: AppendixState) => idOf(state, ru.appendix.seed.aboutMessage)
const short = (id: string) => id.slice(0, 7)
/** Шаги сценария: `edit <файл>` — кнопка ✎, остальное — команды git. */
const play = (state: AppendixState, steps: readonly string[]): AppendixState =>
  steps.reduce((s, step) => (step.startsWith('edit ') ? editAppendixFile(s, step.slice('edit '.length)) : run(s, step).state), state)
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
/** Состояние без истории терминала: то, что команда обязана оставить как было при отказе. */
const core = (s: AppendixState) => ({ head: s.head, branches: s.branches, index: s.index, working: s.working, reflog: s.reflog, commits: s.commits, lastCheckout: s.lastCheckout })

function expectReplay(block: string): void {
  const replay = replayBlock(block)
  const problems = replay.steps.filter((s) => s.mismatch !== null).map((s) => `${s.entry.file}:${s.entry.line} «${s.entry.command}» — ${s.mismatch}`)
  expect(problems).toEqual([])
  expect(replay.steps.length).toBeGreaterThan(0)
}

describe('блоки протокола П8.69–П8.74 и П8.81 проигрываются на движке', () => {
  it('П8.69: reset --hard на ветке: HEAD~1, тот же коммит, ветка, id, тег, HEAD@{n}, ошибки', () => expectReplay('П8.69'))
  it('П8.70: --soft и mixed на чистом дереве', () => expectReplay('П8.70'))
  it('П8.71: правки в рабочем каталоге и в индексе, Unstaged changes after reset', () => expectReplay('П8.71'))
  it('П8.72: reset в отсоединённом HEAD двигает только HEAD', () => expectReplay('П8.72'))
  it('П8.73: reset --hard HEAD@{n} в отсоединённом HEAD на брошенный коммит', () => expectReplay('П8.73'))
  it('П8.74: reset --hard HEAD@{n} на ветке, номера сдвигаются', () => expectReplay('П8.74'))
  it('П8.81: reset на тот же коммит: на ветке запись есть, в отсоединённом HEAD нет', () => expectReplay('П8.81'))
})

describe('reset --hard на ветке (П8.5, П8.10, П8.69)', () => {
  it(`двигает ветку и HEAD вместе, печатает HEAD is now at <id7> <тема>, пишет «reset: moving to HEAD~1» (${where('П8.5', 'git reset --hard HEAD~1')}, ${where('П8.69', 'git reset --hard HEAD~1')})`, () => {
    const s = fresh()
    const r = run(s, 'git reset --hard HEAD~1')
    expect(r.result).toMatchObject({ ok: true, exitCode: 0, output: `HEAD is now at ${short(base(s))} ${ru.appendix.seed.baseMessage}` })
    expect(r.state.branches).toEqual({ master: base(s), feature: s.branches.feature })
    expect(r.state.head).toEqual({ kind: 'branch', name: 'master' })
    expect(r.state.reflog[0]).toEqual({ id: base(s), message: 'reset: moving to HEAD~1' })
    expect(r.state.reflog).toHaveLength(s.reflog.length + 1)
    expect(compareOutputs(protocolEntry('П8.69', 'git reset --hard HEAD~1').output, r.result.output, new Map() as IdMap)).toBeNull()
  })

  it('без ссылки это HEAD: правка пропадает, запись называет HEAD (П8.69, П8.71)', () => {
    const s = runAll(fresh(), ['git reset --hard HEAD~1'])
    const edited = { ...s, working: { ...s.working, 'app.js': 'x\n' } }
    const r = run(edited, 'git reset --hard')
    expect(r.result.output).toBe(`HEAD is now at ${short(base(s))} ${ru.appendix.seed.baseMessage}`)
    expect(r.state.working['app.js']).toBe(ru.appendix.seed.appBase)
    expect(r.state.reflog[0].message).toBe('reset: moving to HEAD')
  })

  it(`запись журнала называет ссылку так, как её ввели: ветка, id7, полный id, тег, ^, HEAD@{n} (${where('П8.69', 'git reset --hard master')}, ${where('П8.5', 'git reset --hard HEAD@{1}')})`, () => {
    const s = runAll(fresh(), ['git tag -a v1.1.0 -m "Релиз" feature'])
    const id7 = short(fix(s))
    for (const [word, target] of [
      ['feature', about(s)],
      ['master', readme(s)],
      [id7, fix(s)],
      [fix(s), fix(s)],
      ['feature^', fix(s)],
      ['v1.1.0', about(s)],
      ['HEAD@{1}', base(s)],
      ['HEAD@{0}', readme(s)],
    ] as const) {
      const r = run(s, `git reset --hard ${word}`)
      expect(r.result.exitCode, word).toBe(0)
      expect(r.state.reflog[0], word).toEqual({ id: target, message: `reset: moving to ${word}` })
      expect(r.state.branches.master, word).toBe(target)
    }
  })

  it(`на тот же коммит на ветке запись всё равно пишется (${where('П8.69', 'git reset --hard HEAD', 0)}, ${where('П8.71', 'git reset --hard')})`, () => {
    const s = fresh()
    const r = run(s, 'git reset --hard HEAD')
    expect(r.result.output).toBe(`HEAD is now at ${short(readme(s))} ${ru.appendix.seed.readmeMessage}`)
    expect(r.state.reflog[0]).toEqual({ id: readme(s), message: 'reset: moving to HEAD' })
    expect(r.state.reflog).toHaveLength(s.reflog.length + 1)
    expect(r.result.explanation).toContain(ax.resetSameCommit)
  })

  it(`reset --hard убирает правки отслеживаемых файлов и подготовку, неотслеживаемый файл оставляет, а лежащий на пути файла коммита перезаписывает (${where('П8.71', 'git reset --hard HEAD')}, ${where('П8.71', 'git reset --hard feature')})`, () => {
    const s0 = runAll(fresh(), ['git reset --hard HEAD~1'])
    let s: AppendixState = { ...s0, working: { ...s0.working, 'app.js': 'правка\n', 'notes.txt': 'заметка\n', 'about.html': 'чужой\n' } }
    s = run({ ...s, index: { ...s.index, 'app.js': 'в индексе\n' } }, 'git reset --hard feature').state
    expect(s.working['app.js']).toBe(ru.appendix.seed.appFixed)
    expect(s.index['app.js']).toBe(ru.appendix.seed.appFixed)
    expect(s.working['notes.txt']).toBe('заметка\n')
    expect(s.working['about.html']).toBe(ru.appendix.seed.aboutHtml)
    expect(s.index['about.html']).toBe(ru.appendix.seed.aboutHtml)
    expect(s.index['notes.txt']).toBeUndefined()
  })

  it('файл, который отслеживался и которого нет у цели, уходит из рабочего каталога и индекса (README.md при reset --hard HEAD~1)', () => {
    const r = run(fresh(), 'git reset --hard HEAD~1')
    expect(Object.keys(r.state.working)).toEqual(['app.js'])
    expect(Object.keys(r.state.index)).toEqual(['app.js'])
  })

  it('ссылка HEAD@{n}: HEAD@{1} после cherry-pick и двух reset указывает не на коммит cherry-pick (место 15, ' + where('П8.5', 'git reset --hard HEAD@{1}') + ')', () => {
    // Как П8.5: cherry-pick, reset --hard HEAD~1 дважды; HEAD@{1} — README, а копия фикса уже HEAD@{2}.
    const s = runAll(fresh(), ['git cherry-pick feature~1', 'git reset --hard HEAD~1', 'git reset --hard HEAD~1'])
    const copy = s.reflog[2]
    expect(copy.message).toBe(`cherry-pick: ${ru.appendix.seed.fixMessage}`)
    expect(s.reflog[1].id).toBe(readme(s))
    const back = run(s, 'git reset --hard HEAD@{1}')
    expect(back.result.output).toBe(`HEAD is now at ${short(readme(s))} ${ru.appendix.seed.readmeMessage}`)
    expect(back.state.branches.master).toBe(readme(s))
    expect(back.state.branches.master).not.toBe(copy.id)
    expect(back.result.explanation).toContain(ax.resetViaReflog('HEAD@{1}', short(readme(s))))
    expect(run(s, 'git reset --hard HEAD@{2}').state.branches.master).toBe(copy.id)
  })
})

describe('режимы --soft, смешанный и --mixed (П8.70, П8.71, О20)', () => {
  it(`--soft двигает ветку и больше ничего: вывод пуст, индекс и рабочий каталог на месте, README подготовлен (${where('П8.70', 'git reset --soft HEAD~1')})`, () => {
    const s = fresh()
    const r = run(s, 'git reset --soft HEAD~1')
    expect(r.result).toMatchObject({ ok: true, output: '', exitCode: 0 })
    expect(r.state.branches.master).toBe(base(s))
    expect(r.state.index).toEqual(s.index)
    expect(r.state.working).toEqual(s.working)
    expect(r.state.reflog[0]).toEqual({ id: base(s), message: 'reset: moving to HEAD~1' })
    expect(run(r.state, 'git status').result.output).toBe(protocolEntry('П8.70', 'git status').output)
  })

  it(`смешанный (без ключа и с --mixed) приводит индекс, рабочий каталог не трогает; на чистом дереве вывод пуст, README становится неотслеживаемым (${where('П8.70', 'git reset HEAD~1')}, ${where('П8.70', 'git reset --mixed HEAD@{1}')})`, () => {
    const s = fresh()
    for (const line of ['git reset HEAD~1', 'git reset --mixed HEAD~1']) {
      const r = run(s, line)
      expect(r.result, line).toMatchObject({ ok: true, output: '', exitCode: 0 })
      expect(r.state.index, line).toEqual({ 'app.js': ru.appendix.seed.appBase })
      expect(r.state.working, line).toEqual(s.working)
      expect(r.state.reflog[0].message, line).toBe(`reset: moving to ${line.split(' ').slice(-1)[0]}`)
    }
  })

  it(`смешанный с правкой печатает Unstaged changes after reset: и M/D по порядку имён (${where('П8.71', 'git reset')}, ${where('П8.70', 'git reset --mixed')}, ${where('П8.71', 'git reset --mixed HEAD~1')})`, () => {
    const edited = runAll(fresh(), ['git reset --soft HEAD~1'])
    const withEdit = { ...edited, working: { ...edited.working, 'app.js': 'правка\n' } }
    expect(run(withEdit, 'git reset').result.output).toBe(['Unstaged changes after reset:', 'M\tapp.js'].join('\n'))
    // D: файл индекса, которого нет в рабочем каталоге; порядок по имени — about.html раньше app.js (П8.70).
    const s = runAll(fresh(), ['git reset --hard feature', 'git reset --hard HEAD~1'])
    const moved = run({ ...s, working: { ...s.working, 'app.js': 'правка\n' } }, 'git reset --soft feature').state
    const lines = run({ ...moved, index: { ...moved.index, 'about.html': ru.appendix.seed.aboutHtml }, working: (({ 'about.html': _a, ...rest }) => rest)({ ...moved.working, 'about.html': 'x' }) }, 'git reset').result.output.split('\n')
    expect(lines).toEqual(['Unstaged changes after reset:', 'D\tabout.html', 'M\tapp.js'])
    expect(protocolEntry('П8.70', 'git reset --mixed').output).toBe(['Unstaged changes after reset:', 'D\tabout.html', 'M\tapp.js'].join('\n'))
  })

  it('файл, вышедший из индекса, теперь неотслеживаемый и в отчёт не попадает; подготовленная правка снимается (П8.71)', () => {
    const s = runAll(fresh(), ['git reset --soft HEAD~1'])
    const withStaged = { ...s, index: { ...s.index, 'app.js': 'подготовлено\n' }, working: { ...s.working, 'app.js': 'подготовлено\n' } }
    const r = run(withStaged, 'git reset')
    expect(r.result.output).toBe(['Unstaged changes after reset:', 'M\tapp.js'].join('\n'))
    expect(r.state.index).toEqual({ 'app.js': ru.appendix.seed.appBase })
    expect(r.state.working['README.md']).toBe(ru.appendix.seed.readme)
  })

  it('режимы меняют индекс и рабочий каталог так: soft — ничего, mixed — индекс, hard — оба', () => {
    const s = runAll(fresh(), ['git reset --soft feature'])
    const dirty: AppendixState = { ...s, working: { ...s.working, 'app.js': 'правка\n' }, index: { ...s.index, 'app.js': 'подготовлено\n' } }
    const target = fix(s)
    const soft = run(dirty, `git reset --soft ${short(target)}`).state
    const mixed = run(dirty, `git reset --mixed ${short(target)}`).state
    const hard = run(dirty, `git reset --hard ${short(target)}`).state
    expect([soft.index['app.js'], soft.working['app.js']]).toEqual(['подготовлено\n', 'правка\n'])
    expect([mixed.index['app.js'], mixed.working['app.js']]).toEqual([ru.appendix.seed.appFixed, 'правка\n'])
    expect([hard.index['app.js'], hard.working['app.js']]).toEqual([ru.appendix.seed.appFixed, ru.appendix.seed.appFixed])
    for (const st of [soft, mixed, hard]) expect(st.branches.master).toBe(target)
  })

  it(`на тот же коммит запись пишется и у --soft, и у смешанного (${where('П8.70', 'git reset')}, ${where('П8.81', 'git reset --soft HEAD')})`, () => {
    for (const line of ['git reset', 'git reset --soft', 'git reset --mixed']) {
      const r = run(fresh(), line)
      expect(r.result, line).toMatchObject({ ok: true, output: '', exitCode: 0 })
      expect(r.state.reflog[0].message, line).toBe('reset: moving to HEAD')
      expect(r.state.reflog, line).toHaveLength(7)
    }
  })

  it('пояснения: --hard, --soft и смешанный называют, что тронуто; mixed с правкой объясняет отчёт', () => {
    expect(run(fresh(), 'git reset --hard HEAD~1').result.explanation).toContain('передвинул ветку master')
    expect(run(fresh(), 'git reset --soft HEAD~1').result.explanation).toContain('Индекс и рабочий каталог не тронуты')
    expect(run(fresh(), 'git reset HEAD~1').result.explanation).toContain('Индекс приведён к состоянию коммита')
    const s = runAll(fresh(), ['git reset --soft HEAD~1'])
    const edited = { ...s, working: { ...s.working, 'app.js': 'правка\n' } }
    expect(run(edited, 'git reset').result.explanation).toContain('Unstaged changes after reset')
  })
})

describe('reset в отсоединённом HEAD: двигается только HEAD (О6, О20, П8.72, П8.73, П8.81)', () => {
  const detached = runAll(fresh(), ['git checkout --detach master'])

  it(`reset --hard HEAD~1: ветки на месте, HEAD на новом коммите, lastCheckout прежнее (${where('П8.72', 'git reset --hard HEAD~1')}, ${where('О6', 'git reset --hard HEAD~1')})`, () => {
    const r = run(detached, 'git reset --hard HEAD~1')
    expect(r.result.output).toBe(`HEAD is now at ${short(base(detached))} ${ru.appendix.seed.baseMessage}`)
    expect(r.state.branches).toEqual(detached.branches)
    expect(r.state.head).toEqual({ kind: 'detached', id: base(detached) })
    expect(r.state.lastCheckout).toEqual(detached.lastCheckout)
    expect(r.state.reflog[0]).toEqual({ id: base(detached), message: 'reset: moving to HEAD~1' })
    expect(r.result.explanation).toContain('В отсоединённом HEAD reset --hard двигает только HEAD')
  })

  it(`reset --hard HEAD@{n} на коммит, который держит только журнал: ветка не двигается, миссия 6 не засчитывается (${where('П8.73', 'git reset --hard HEAD@{2}')}, target.md, часть XII, «Миссии»)`, () => {
    const withCommit = play(fresh(), ['git checkout --detach master', 'edit app.js', 'git commit -am "Эксперимент"', 'git checkout master', 'git checkout --detach master'])
    const experiment = idOf(withCommit, 'Эксперимент')
    expect(getCommits(withCommit).find((c) => c.id === experiment)?.faded).toBe(true)
    const r = run(withCommit, 'git reset --hard HEAD@{2}')
    expect(r.result.output).toBe(`HEAD is now at ${short(experiment)} Эксперимент`)
    expect(r.state.branches).toEqual(withCommit.branches)
    expect(r.state.head).toEqual({ kind: 'detached', id: experiment })
    expect(r.state.missionsDone.rescueCommit).toBe(false)
    expect(getCommits(r.state).find((c) => c.id === experiment)?.faded).toBe(false)
  })

  it(`--soft и смешанный двигают только HEAD, индекс и рабочий каталог — как в разделе 4 (${where('О20', 'git reset --soft HEAD~1')}, ${where('О20', 'git reset HEAD@{1}')})`, () => {
    const soft = run(detached, 'git reset --soft HEAD~1')
    expect(soft.result).toMatchObject({ output: '', exitCode: 0 })
    expect(soft.state.branches).toEqual(detached.branches)
    expect(soft.state.index).toEqual(detached.index)
    expect(run(soft.state, 'git status').result.output).toBe(['HEAD detached from refs/heads/master', 'Changes to be committed:', '  (use "git restore --staged <file>..." to unstage)', '\tnew file:   README.md', ''].join('\n'))
    const back = run(soft.state, 'git reset HEAD@{1}')
    expect(back.result.output).toBe('')
    expect(back.state.head).toEqual({ kind: 'detached', id: readme(detached) })
    expect(run(back.state, 'git status').result.output).toBe('HEAD detached at refs/heads/master\nnothing to commit, working tree clean')
  })

  it(`reset на тот же коммит в отсоединённом HEAD не пишет в журнал, на ветке пишет (${where('П8.81', 'git reset --hard HEAD', 0)}, ${where('П8.81', 'git reset --hard HEAD', 1)})`, () => {
    for (const line of ['git reset --hard HEAD', 'git reset --hard master', 'git reset --soft HEAD', 'git reset HEAD@{0}', 'git reset']) {
      const r = run(detached, line)
      expect(r.result.exitCode, line).toBe(0)
      expect(r.state.reflog, line).toEqual(detached.reflog)
    }
    const away = runAll(detached, ['git reset --hard HEAD~1'])
    expect(away.reflog).toHaveLength(detached.reflog.length + 1)
    expect(run(away, 'git reset --hard HEAD').state.reflog).toEqual(away.reflog)
    const onBranch = runAll(away, ['git checkout master'])
    expect(run(onBranch, 'git reset --hard HEAD').state.reflog).toHaveLength(onBranch.reflog.length + 1)
  })

  it('git branch и git log --all после reset в отсоединённом HEAD: ветки на местах, HEAD у нового коммита (П8.72)', () => {
    const r = runAll(detached, ['git reset --hard HEAD~1'])
    expect(run(r, 'git branch').result.output).toBe(['* (HEAD detached from refs/heads/master)', '  feature', '  master'].join('\n'))
    const log = run(r, 'git log --oneline --all').result.output.split('\n')
    expect(log[log.length - 1]).toBe(`${short(base(r))} (HEAD) ${ru.appendix.seed.baseMessage}`)
    expect(log[0]).toBe(`${short(readme(r))} (master) ${ru.appendix.seed.readmeMessage}`)
  })
})

describe('брошенные коммиты бледнеют и возвращаются (target.md, часть X, «Движок»; место 15)', () => {
  const faded = (s: AppendixState) => getCommits(s).filter((c) => c.faded).map((c) => c.id)

  it(`после reset --hard HEAD~1 коммит README бледный, после reset --hard HEAD@{1} снова обычный (${where('П8.74', 'git reset --hard HEAD@{1}')})`, () => {
    const s = runAll(fresh(), ['git reset --hard HEAD~1'])
    expect(faded(s)).toEqual([readme(s)])
    const rescued = run(s, 'git reset --hard HEAD@{1}')
    expect(faded(rescued.state)).toEqual([])
    expect(rescued.state.branches.master).toBe(readme(s))
  })

  it('коммиты в стороне от веток и тегов бледнеют; тег на них гасит бледность; ветка feature — тоже', () => {
    const s = runAll(fresh(), ['git reset --hard feature'])
    expect(faded(s)).toEqual([readme(s)])
    expect(faded(runAll(s, ['git tag keep HEAD@{1}']))).toEqual([])
    expect(faded(runAll(s, ['git branch rescue HEAD@{1}']))).toEqual([])
    const deeper = runAll(fresh(), ['git cherry-pick feature~1', 'git reset --hard HEAD~2'])
    expect(faded(deeper)).toHaveLength(2)
  })

  it('речь называет число брошенных коммитов и путь назад; если брошенных нет, об этом молчит', () => {
    const r = run(fresh(), 'git reset --hard HEAD~1')
    expect(r.result.explanation).toContain(ax.resetLeftBehind(1))
    expect(run(fresh(), 'git reset --hard feature').result.explanation).toContain(ax.resetLeftBehind(1))
    expect(run(fresh(), 'git reset --soft HEAD').result.explanation).not.toContain('бледные')
    const forward = runAll(fresh(), ['git reset --hard HEAD~1'])
    expect(run(forward, 'git reset --hard HEAD@{1}').result.explanation).not.toContain('бледные')
  })

  it('reset вперёд в отсоединённом HEAD не бросает коммит, на котором стоял HEAD: он достижим с нового места', () => {
    const s = play(fresh(), ['git checkout --detach feature~1', 'edit app.js', 'git commit -am "Опыт"'])
    const experiment = idOf(s, 'Опыт')
    const back = run(s, 'git reset --hard HEAD~1')
    expect(faded(back.state)).toEqual([experiment])
    expect(back.result.explanation).toContain(ax.resetLeftBehind(1))
    const forward = run(back.state, 'git reset --hard HEAD@{1}')
    expect(faded(forward.state)).toEqual([])
    expect(forward.result.explanation).not.toContain('бледные')
  })
})

describe('ошибки git и отказы области', () => {
  it(`слово, которого нет среди ссылок и файлов: fatal: ambiguous argument, код 128, ничего не меняется (${where('П8.69', 'git reset --hard nosuch')}, ${where('П8.69', 'git reset --hard HEAD~9')})`, () => {
    const s = fresh()
    for (const word of ['nosuch', 'HEAD~9']) {
      const r = run(s, `git reset --hard ${word}`)
      expect(r.result.exitCode, word).toBe(128)
      expect(r.result.ok, word).toBe(false)
      expect(r.result.output, word).toBe(protocolEntry('П8.69', `git reset --hard ${word}`).output)
      expect(core(r.state), word).toEqual(core(s))
    }
  })

  it(`HEAD@{n} за концом журнала: fatal: log for 'HEAD' only has N entries, код 128, ветка и журнал на месте (${where('П8.69', 'git reset --hard HEAD@{99}')}, ${where('П8.5', 'git reset --hard HEAD@{99}')})`, () => {
    const s = runAll(fresh(), ['git reset --hard HEAD~1'])
    const r = run(s, 'git reset --hard HEAD@{99}')
    expect(r.result).toMatchObject({ ok: false, exitCode: 128, output: "fatal: log for 'HEAD' only has 7 entries" })
    expect(core(r.state)).toEqual(core(s))
    expect(protocolEntry('П8.5', 'git reset --hard HEAD@{99}').output).toBe("fatal: log for 'HEAD' only has 13 entries")
    for (const mode of ['--soft', '--mixed', '']) expect(run(s, `git reset ${mode} HEAD@{99}`).result.exitCode, mode).toBe(128)
  })

  it('имя файла вместо ссылки и несколько слов — отказ области (пути не разбираются), ничего не меняется', () => {
    const s = fresh()
    for (const line of ['git reset app.js', 'git reset HEAD app.js', 'git reset --soft app.js', 'git reset HEAD~1 HEAD', 'git reset README.md']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(core(r.state), line).toEqual(core(s))
    }
    expect(run(s, 'git reset app.js').result.output).toBe(ae.resetPathForm('app.js'))
  })

  it('ключи и формы вне области — отказ области: --keep, --merge, -q, -p, --, два режима, ссылка вне грамматики', () => {
    const s = fresh()
    for (const line of ['git reset --keep HEAD~1', 'git reset --merge', 'git reset -q', 'git reset -p', 'git reset -- app.js', 'git reset HEAD~1 -- app.js', 'git reset --soft --hard', 'git reset --hard --hard', 'git reset --hard HEAD@{1}~1', 'git reset --hard master@{1}', 'git reset --hard HEAD@{01}', 'git reset --bogus']) {
      const r = run(s, line)
      refusal(r.result.output)
      expect(r.result.exitCode, line).toBeUndefined()
      expect(core(r.state), line).toEqual(core(s))
    }
  })

  it('отказ ничего не засчитывает и не пишет в журнал', () => {
    const s = fresh()
    for (const line of ['git reset --keep', 'git reset --hard nosuch', 'git reset --hard HEAD@{99}', 'git reset app.js']) {
      expect(run(s, line).state.missionsDone, line).toEqual(s.missionsDone)
    }
  })
})

describe('миссия 6: успешный reset --hard HEAD@{n} на коммит, недостижимый ни из ветки, ни из тега (target.md, часть X, «Миссии»)', () => {
  const lost = () => runAll(fresh(), ['git cherry-pick feature~1', 'git reset --hard HEAD~1'])

  it('засчитывается на ветке, когда коммит брошен (путь миссии: cherry-pick, reset --hard HEAD~1, reflog, reset --hard HEAD@{1})', () => {
    const s = lost()
    expect(s.missionsDone.rescueCommit).toBe(false)
    const r = run(s, 'git reset --hard HEAD@{1}')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.missionsDone.rescueCommit).toBe(true)
    expect(getAppendixMissions(r.state).map((m) => m.done)).toEqual([false, false, false, false, true, true])
    expect(r.result.explanation).toContain(ax.resetRescued('master', short(r.state.branches.master)))
  })

  it('не засчитывается, если коммит достижим из ветки или тега, на --soft и смешанном, на HEAD~n и на id', () => {
    const s = fresh()
    // HEAD@{1} — базовый коммит: его держат master и feature.
    expect(run(s, 'git reset --hard HEAD@{1}').state.missionsDone.rescueCommit).toBe(false)
    expect(run(s, 'git reset --hard HEAD~1').state.missionsDone.rescueCommit).toBe(false)
    const l = lost()
    expect(run(l, 'git reset --soft HEAD@{1}').state.missionsDone.rescueCommit).toBe(false)
    expect(run(l, 'git reset HEAD@{1}').state.missionsDone.rescueCommit).toBe(false)
    expect(run(l, `git reset --hard ${short(l.reflog[1].id)}`).state.missionsDone.rescueCommit).toBe(false)
    expect(run(l, 'git reset --hard HEAD@{1}').state.missionsDone.rescueCommit).toBe(true)
    // тег на брошенном коммите возвращает ему достижимость
    const tagged = runAll(l, ['git tag keep HEAD@{1}'])
    expect(run(tagged, 'git reset --hard HEAD@{1}').state.missionsDone.rescueCommit).toBe(false)
    // отказ git не засчитывает
    expect(run(l, 'git reset --hard HEAD@{99}').state.missionsDone.rescueCommit).toBe(false)
  })

  it('в отсоединённом HEAD не засчитывается: ветка не двигается (target.md, часть XII, «Миссии»; ' + where('П8.73', 'git reset --hard HEAD@{2}') + ')', () => {
    const s = play(fresh(), ['git checkout --detach master', 'edit app.js', 'git commit -am "Эксперимент"', 'git checkout master', 'git checkout --detach master'])
    const r = run(s, 'git reset --hard HEAD@{2}')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.head).toEqual({ kind: 'detached', id: idOf(s, 'Эксперимент') })
    expect(r.state.missionsDone.rescueCommit).toBe(false)
    expect(r.state.branches).toEqual(s.branches)
  })

  it('засчитанная миссия остаётся после следующих команд (часть I, п. 2)', () => {
    const done = run(lost(), 'git reset --hard HEAD@{1}').state
    const later = runAll(done, ['git reset --hard HEAD~1', 'git checkout feature', 'git reset --hard HEAD@{99}'])
    expect(later.missionsDone.rescueCommit).toBe(true)
  })
})
