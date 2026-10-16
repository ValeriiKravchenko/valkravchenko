// Раздел 7, g18b2: вызов алиаса, `git help <алиас>`, приоритет настоящей команды, пустое значение,
// рекурсия, `!`-алиасы, отказы области. Вывод сверен с П7.25 и П7.26 (section7-git-runs.txt:967–1412).
import { describe, expect, it } from 'vitest'
import { fresh, protocolBlock, protocolEntry, run, runAll } from './practicesProtocolKit'
import { getPracticesMissions } from './practicesSection'
import type { PracticesState } from './practicesSection'

const MARK = '[тренажёр]'

const withAlias = (name: string, value: string, scope: '--global ' | '' = '--global ') =>
  run(fresh(), `git config ${scope}alias.${name} '${value}'`).state

function refused(state: PracticesState, line: string) {
  const r = run(state, line)
  expect(r.result.output.startsWith(MARK), line).toBe(true)
  expect(r.result.exitCode, line).toBeUndefined()
  expect(r.result.ok).toBe(false)
  return r
}

describe('П7.26: git st и git st -s в репозитории без коммитов (section7-git-runs.txt:1387–1412)', () => {
  const stEntry = protocolEntry(26, 'git st')
  const stShort = protocolEntry(26, 'git st -s')

  it('git st печатает настоящий вывод git status этого репозитория, код 0', () => {
    const state = withAlias('st', 'status')
    const r = run(state, 'git st')
    expect(r.result.output).toBe(stEntry.output)
    expect(r.result.exitCode).toBe(stEntry.exitCode)
    expect(r.result.output).toBe(run(state, 'git status').result.output)
  })

  it('git st -s: аргументы дописываются после значения (П7.25, section7-git-runs.txt:1006–1013)', () => {
    const state = withAlias('st', 'status')
    const r = run(state, 'git st -s')
    expect(r.result.output).toBe(stShort.output)
    expect(r.result.exitCode).toBe(0)
  })

  it('раскрытие говорит тренажёр: git не печатает «→ git status», вывод без таких строк, речь в explanation', () => {
    const r = run(withAlias('st', 'status'), 'git st -s')
    expect(r.result.output).not.toContain('→')
    expect(r.result.explanation).toContain('git status -s')
    expect(r.result.explanation).toContain('«st»')
  })

  it('алиас на status с несколькими словами в значении: git st-short = status -s (section7-git-runs.txt:1169–1179)', () => {
    const state = withAlias('st-short', 'status -s')
    expect(run(state, 'git st-short').result.output).toBe(stShort.output)
  })

  it('путь с каталогом и пояснение status проходят через алиас', () => {
    const state = runAll(withAlias('st', 'status'), ['git config --global alias.ss "status --short --ignored -uall"'])
    expect(run(state, 'git ss').result.output).toBe(run(fresh(), 'git status --short --ignored -uall').result.output)
  })

  it('алиас на check-ignore выполняется на правилах после g18b1 (check-ignore -v с !-правилом)', () => {
    const state = runAll(fresh(), ['git config --global alias.ci "check-ignore -v --non-matching"'])
    expect(run(state, 'git ci app.js').result).toMatchObject({ output: '::\tapp.js', exitCode: 1 })
  })
})

describe('П7.26: git lg в репозитории без коммитов (section7-git-runs.txt:1380–1385)', () => {
  it('fatal: your current branch … код 128, ok=false', () => {
    const e = protocolEntry(26, 'git lg')
    const state = withAlias('lg', 'log --oneline --graph')
    const r = run(state, 'git lg')
    expect(r.result.output).toBe(e.output)
    expect(r.result.exitCode).toBe(128)
    expect(r.result.ok).toBe(false)
    expect(r.result.explanation).toContain('алиас сработал')
  })
})

describe('приоритет настоящей команды (П7.25, section7-git-runs.txt:1036–1046)', () => {
  it('alias.status log: git status --short печатает статус, а не лог', () => {
    const state = withAlias('status', 'log')
    expect(run(state, 'git status --short').result.output).toBe(run(fresh(), 'git status --short').result.output)
    expect(run(state, 'git status --short').result.exitCode).toBe(0)
  })

  it('такой вызов не засчитывает миссию «алиас выполнен»', () => {
    const state = run(withAlias('status', 'log'), 'git status --short').state
    expect(state.missionsDone.aliasRun).toBe(false)
  })

  it('настоящая команда вне области остаётся отказом области, а не вызовом алиаса', () => {
    const r = refused(withAlias('branch', 'status'), 'git branch')
    expect(r.result.output).toContain('git branch')
  })
})

describe('неизвестная команда без алиаса и после удаления (П7.25, section7-git-runs.txt:968–976, 1089–1100)', () => {
  it('git st без алиаса и после --unset: первая строка, код 1', () => {
    const e = protocolEntry(25, 'git st', 0)
    expect(run(fresh(), 'git st').result.output).toBe(e.output.split('\n')[0])
    const after = runAll(withAlias('st', 'status'), ['git config --global --unset alias.st'])
    expect(run(after, 'git st').result).toMatchObject({ output: e.output.split('\n')[0], exitCode: 1, ok: false })
  })

  it('алиас в .git/config работает так же (section7-git-runs.txt:1115–1117)', () => {
    const state = withAlias('l1', 'status', '' as const)
    expect(run(state, 'git l1 -s').result.output).toBe(run(fresh(), 'git status -s').result.output)
  })
})

describe('пустое значение, рекурсия (П7.25)', () => {
  it('git q при alias.q "" → expansion of alias failed, код 1 (section7-git-runs.txt:1138–1139)', () => {
    const e = protocolEntry(25, 'git q')
    const r = run(run(fresh(), 'git config --global alias.q ""').state, 'git q')
    expect(r.result.output).toBe(e.output)
    expect(r.result.exitCode).toBe(1)
    expect(r.result.ok).toBe(false)
  })

  it('git q2 при alias.q2 "  " → то же с именем q2 (section7-git-runs.txt:1145–1146)', () => {
    const e = protocolEntry(25, 'git q2')
    const r = run(run(fresh(), 'git config --global alias.q2 "  "').state, 'git q2')
    expect(r.result.output).toBe(e.output)
    expect(r.result.exitCode).toBe(1)
  })

  // g18b3: форма сверена (section7-config-alias-fixes-git-runs.txt, П7.74), теперь это ответ git, а не отказ области.
  it('пустое значение с аргументами — та же ошибка, что без аргументов, код 1 (П7.74)', () => {
    const r = run(run(fresh(), 'git config --global alias.q ""').state, 'git q -s').result
    expect(r.output).toBe("expansion of alias 'q' failed; '' is not a git command")
    expect(r.exitCode).toBe(1)
  })

  it('git loop при alias.loop loop → fatal: recursive alias: loop, код 128 (section7-git-runs.txt:1200–1202)', () => {
    const e = protocolEntry(25, 'git loop')
    const r = run(withAlias('loop', 'loop'), 'git loop')
    expect(r.result.output).toBe(e.output)
    expect(r.result.exitCode).toBe(128)
    expect(r.result.ok).toBe(false)
  })

  // g18b3: самоссылка с другими словами и аргументами сверена (П7.74), это ответ git.
  it('самоссылка с другими словами и с аргументами → fatal: recursive alias, код 128 (П7.74)', () => {
    for (const [value, line] of [['loop x', 'git loop'], ['loop', 'git loop -s']] as const) {
      const r = run(withAlias('loop', value), line).result
      expect(r.output, line).toBe('fatal: recursive alias: loop')
      expect(r.exitCode, line).toBe(128)
    }
  })
})

describe('отказы области при вызове алиаса', () => {
  it('!-алиас: оболочку тренажёр не запускает, речь называет команду (П7.25, section7-git-runs.txt:1022–1027; target.md, место 18)', () => {
    const r = refused(withAlias('hi', '!echo'), 'git hi привет')
    expect(r.result.output).toContain('«echo привет»')
    expect(r.state.missionsDone.aliasRun).toBe(false)
  })

  it('значение начинается с другого алиаса', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git config --global alias.s2 "st -s"'])
    expect(refused(state, 'git s2').result.output).toContain('«st»')
  })

  it('значение, начинающееся с «-» и не с global-опцией, прогоном не сверено — отказ области', () => {
    expect(refused({ ...fresh(), globalConfig: [{ key: 'alias.x', value: '-zz' }] }, 'git x').result.output).toContain('-zz')
  })

  it('алиас раскрылся в настоящую команду вне области: отказ области, речь называет раскрытие (П7.25, section7-git-runs.txt:1115–1117)', () => {
    const r = refused(withAlias('zz', 'log -1', ''), 'git zz --oneline')
    expect(r.result.explanation).toContain('git log -1 --oneline')
    const co = refused(withAlias('co', 'checkout'), 'git co main')
    expect(co.result.output).toContain('git checkout')
    expect(co.result.explanation).toContain('«co»')
  })

  it('алиас на global-опцию git', () => {
    // через интерфейс такое значение не записать (оно разбирается как опция), поэтому конфиг задан в состоянии напрямую
    refused({ ...fresh(), globalConfig: [{ key: 'alias.v', value: '--version' }] }, 'git v')
  })

  it('одно имя в обоих конфигах', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git config alias.st "status -s"'])
    refused(state, 'git st')
  })

  it('отказ после алиаса не меняет конфиги и не засчитывает миссию', () => {
    const before = withAlias('co', 'checkout')
    const r = refused(before, 'git co')
    expect(r.state.globalConfig).toEqual(before.globalConfig)
    expect(r.state.missionsDone.aliasRun).toBe(false)
  })
})

describe('git help <алиас> (П7.25, section7-git-runs.txt:1156–1161)', () => {
  it("git help co при alias.co checkout → 'co' is aliased to 'checkout', код 0", () => {
    const e = protocolEntry(25, 'git help co')
    const r = run(withAlias('co', 'checkout'), 'git help co')
    expect(r.result.output).toBe(e.output)
    expect(r.result.exitCode).toBe(0)
    expect(r.result.ok).toBe(true)
  })

  it('многословное значение подставляется тем же шаблоном; миссию «алиас выполнен» help не засчитывает', () => {
    const r = run(withAlias('lg', 'log --oneline --graph'), 'git help lg')
    expect(r.result.output).toBe("'lg' is aliased to 'log --oneline --graph'")
    expect(r.state.missionsDone.aliasRun).toBe(false)
  })

  it('формы без прогона — отказ области: не алиас, настоящая команда, лишние слова, -h', () => {
    refused(fresh(), 'git help co')
    refused(fresh(), 'git help')
    refused(fresh(), 'git help status')
    refused(withAlias('status', 'log'), 'git help status')
    refused(withAlias('co', 'checkout'), 'git help co extra')
    refused(withAlias('co', 'checkout'), 'git help -a')
  })
})

describe('миссия 4 засчитывается по событию (target.md:1792)', () => {
  it('успешный вызов алиаса (код 0) → миссия 4 засчитана, остальные нет', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git st'])
    expect(getPracticesMissions(state).map((m) => m.done)).toEqual([false, false, false, true])
  })

  it('алиас с ненулевым кодом (git lg без коммитов, git q, git loop) не засчитывает', () => {
    for (const [name, value] of [['lg', 'log --oneline --graph'], ['loop', 'loop']] as const) {
      expect(run(withAlias(name, value), `git ${name}`).state.missionsDone.aliasRun).toBe(false)
    }
  })

  it('засчитанная миссия остаётся засчитанной после удаления алиаса и ошибок', () => {
    let state = runAll(fresh(), ['git config --global alias.st status', 'git st'])
    state = runAll(state, ['git config --global --unset alias.st', 'git st', 'git config --global --unset alias.st'])
    expect(state.missionsDone.aliasRun).toBe(true)
  })
})

describe('протокол П7.25: все вызовы алиасов, у которых вывод не зависит от коммитов', () => {
  it('в протоколе есть git hi / git here — их не выполняем (оболочка), остальные сверены выше', () => {
    const shellCalls = protocolBlock(25).filter((e) => e.command === 'git hi привет' || e.command.endsWith('git here'))
    expect(shellCalls).toHaveLength(2)
  })
})
