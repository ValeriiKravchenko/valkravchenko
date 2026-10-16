// Раздел 7, g18b3: поправки git config и алиасов. Вывод и коды берутся из
// docs/git-trainer/reports/section7-config-alias-fixes-git-runs.txt (git 2.53.0, блоки П7.60–П7.80);
// в именах тестов указан блок. Пункты задания: 1 — порядок опций, 2 — регистр имени, 3 — --get-regexp,
// 4 — пустое значение, 5 — формы вызова алиаса, 6 — классы ключей и речь.
import { describe, expect, it } from 'vitest'
import { fixBlock, fixEntry, fresh, run, runAll } from './practicesProtocolKit'
import type { ProtocolEntry } from './practicesProtocolKit'
import { getConfigEntries, getConfigFileText, getPracticesMissions } from './practicesSection'
import type { PracticesState } from './practicesSection'
import { compileEre, setConfigEntry } from './practicesConfig'
import { ru } from '../locales/ru'

const MARK = '[тренажёр]'

type Mode = 'exact' | 'code' | 'refused' | 'skip'

/** Выполняет команды блока подряд на одном состоянии и сверяет с git: вывод и код (`exact`), только код, отказ области или пропуск. */
function replay(id: number, mode: (e: ProtocolEntry) => Mode = () => 'exact'): PracticesState {
  let state = fresh()
  for (const e of fixBlock(id)) {
    const m = mode(e)
    const where = `П7.${id}, section7-config-alias-fixes-git-runs.txt: ${e.command}`
    if (m === 'skip') continue
    if (e.command === 'cat ~/.gitconfig' || e.command === 'cat .git/config') {
      const text = getConfigFileText(state, e.command === 'cat .git/config' ? 'local' : 'global')
      expect(text, where).toBe(e.output === '' ? '' : `${e.output}\n`)
      continue
    }
    const r = run(state, e.command)
    state = r.state
    if (m === 'refused') {
      expect(r.result.output.startsWith(MARK), where).toBe(true)
      expect(r.result.exitCode, where).toBeUndefined()
      continue
    }
    expect(r.result.exitCode, where).toBe(e.exitCode)
    expect(r.result.ok, where).toBe(e.exitCode === 0)
    if (m === 'exact') expect(r.result.output, where).toBe(e.output)
  }
  return state
}

const expectGit = (state: PracticesState, id: number, command: string, nth = 0) => {
  const e = fixEntry(id, command, nth)
  const r = run(state, command)
  expect(r.result.output, `П7.${id}: ${command}`).toBe(e.output)
  expect(r.result.exitCode, `П7.${id}: ${command}`).toBe(e.exitCode)
  return r
}

describe('п. 1: опции читаются только до первого слова (П7.60–П7.65)', () => {
  it('П7.60: --global alias.st --unset, --get, --get-regexp записывают значение в ~/.gitconfig, код 0', () => {
    const state = replay(60)
    expect(getConfigEntries(state, 'global')).toEqual([
      { key: 'alias.st', value: '--unset' },
      { key: 'alias.co', value: '--get' },
      { key: 'alias.lg', value: '--get-regexp' },
      { key: 'alias.y', value: '--unset' },
    ])
    expect(getConfigEntries(state, 'local')).toEqual([])
  })

  it('П7.61: git config alias.zz --global пишет значение --global в .git/config, ~/.gitconfig пуст', () => {
    const state = replay(61)
    expect(getConfigEntries(state, 'local')).toEqual([{ key: 'alias.zz', value: '--global' }])
    expect(getConfigEntries(state, 'global')).toEqual([])
  })

  it('П7.62: git config alias.co checkout --global — запись co = checkout в .git/config, в ~/.gitconfig ничего', () => {
    const state = replay(62)
    expect(getConfigEntries(state, 'local').map((e) => `${e.key}=${e.value}`)).toEqual(['alias.co=checkout', 'alias.lg=log', 'alias.pp=log'])
    expect(getConfigEntries(state, 'global')).toEqual([])
  })

  it('П7.62: недопустимый шаблон значения → error: invalid pattern: [, код 6, запись не создана', () => {
    const e = fixEntry(62, 'git config alias.bad log "["')
    const r = run(fresh(), e.command)
    expect(r.result.output).toBe(e.output)
    expect(r.result.exitCode).toBe(6)
    expect(r.state.localConfig).toEqual([])
  })

  it('П7.65: git config --unset alias.co --global → код 5, запись co остаётся (в .git/config её нет)', () => {
    const state = replay(65)
    expect(getConfigEntries(state, 'global')).toEqual([])
  })

  it('П7.65: --unset alias.co --global при записи в .git/config → код 5, запись остаётся', () => {
    const state = runAll(fresh(), ['git config alias.zz "log -1"'])
    const r = run(state, 'git config --unset alias.zz --global')
    expect(r.result).toMatchObject({ output: '', exitCode: 5 })
    expect(r.state.localConfig).toEqual([{ key: 'alias.zz', value: 'log -1' }])
  })

  it('П7.65: --unset со словом после ключа — шаблон значения: log подошёл к «log -1», запись удалена, код 0', () => {
    const state = runAll(fresh(), ['git config alias.zz "log -1"'])
    const r = run(state, 'git config --unset alias.zz log')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.localConfig).toEqual([])
  })

  it('П7.65: удаление без --global идёт в .git/config, ~/.gitconfig не затронут', () => {
    const state = runAll(fresh(), ['git config --global alias.zz status', 'git config alias.zz "log -1"'])
    const r = run(state, 'git config --unset alias.zz')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.localConfig).toEqual([])
    expect(r.state.globalConfig).toEqual([{ key: 'alias.zz', value: 'status' }])
  })

  it('П7.65: чтение с шаблоном значения: check/^c.*t$ подходят, CHECK и --foo нет, [ — код 6', () => {
    replay(65)
  })

  it('П7.64: четыре слова и больше → error: no action specified, код 129, конфиги не меняются', () => {
    const state = replay(64)
    expect(state.globalConfig).toEqual([])
    expect(state.localConfig).toEqual([])
    const r = run(fresh(), 'git config --global alias.lg log --oneline --graph')
    expect(r.result.explanation).toContain('шелл')
  })

  it('П7.63: третье слово при существующем ключе — git дописывает значения, тренажёр отказывает и конфиг не меняет', () => {
    const base = runAll(fresh(), ['git config --global alias.co checkout'])
    const r = run(base, 'git config --global alias.co new --global')
    expect(r.result.output.startsWith(MARK)).toBe(true)
    expect(r.result.exitCode).toBeUndefined()
    expect(r.state.globalConfig).toEqual(base.globalConfig)
  })

  it('третье слово записи объясняется речью: шаблон значения не использован', () => {
    const r = run(fresh(), 'git config alias.lg log --oneline')
    expect(r.result.explanation).toContain('шаблон значения')
    expect(r.result.explanation).toContain('кавычки')
  })

  it('П7.60: после подкоманды правило то же: git config set --global alias.y --unset пишет значение --unset, код 0', () => {
    const r = run(fresh(), 'git config set --global alias.y --unset')
    expect(fixEntry(60, 'git config set --global alias.y --unset').exitCode).toBe(0)
    expect(r.result.exitCode).toBe(0)
    expect(r.state.globalConfig).toEqual([{ key: 'alias.y', value: '--unset' }])
  })
})

describe('п. 2: имя алиаса без учёта регистра (П7.67–П7.69)', () => {
  it('П7.67: git help ST и git help st, запись alias.St заменяет st на месте, имя в файле как набрано', () => {
    const state = replay(67)
    expect(state.globalConfig).toEqual([])
  })

  it('П7.67: после alias.St log файл содержит «St = log», --list печатает alias.st=log', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git config --global alias.St log'])
    expect(state.globalConfig).toEqual([{ key: 'alias.St', value: 'log' }])
    expect(getConfigFileText(state, 'global')).toBe(`${fixEntry(67, 'cat ~/.gitconfig').output}\n`)
  })

  it('П7.69: замена на месте и порядок записей', () => {
    replay(69)
  })

  it('П7.68: git ST и git sT -s выполняют status, код 0', () => {
    const state = runAll(fresh(), ['git config --global alias.st status'])
    const direct = run(state, 'git status').result
    const upper = run(state, 'git ST').result
    expect(upper.exitCode).toBe(fixEntry(68, 'git ST').exitCode)
    expect(upper.output).toBe(direct.output)
    const short = run(state, 'git sT -s').result
    expect(short.exitCode).toBe(fixEntry(68, 'git sT -s').exitCode)
    expect(short.output).toBe(run(state, 'git status -s').result.output)
    replay(68, () => 'code')
  })

  it('П7.68: миссия 4 засчитывается для git ST', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git ST'])
    expect(getPracticesMissions(state).map((m) => m.done)).toEqual([false, false, false, true])
  })

  it('П7.76: git help STATUS для alias.status — алиас (регистр отличается от настоящей команды)', () => {
    const state = runAll(fresh(), ['git config --global alias.status log'])
    expectGit(state, 76, 'git help STATUS')
    expectGit(state, 76, 'git help Status')
    expect(run(state, 'git help status').result.output.startsWith(MARK)).toBe(true)
  })

  it('П7.70: ключ с другим регистром имени секции (Alias.st) — отказ области', () => {
    const r = run(fresh(), 'git config --global Alias.st status')
    expect(r.result.output.startsWith(MARK)).toBe(true)
    expect(r.state.globalConfig).toEqual([])
  })

  it('П7.70: одно имя в обоих файлах — отказ области (git берёт локальное)', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git config alias.St log'])
    const r = run(state, 'git ST')
    expect(r.result.output.startsWith(MARK)).toBe(true)
    expect(r.result.exitCode).toBeUndefined()
  })

  it('setConfigEntry сравнивает имя без учёта регистра и не мутирует список', () => {
    const before = [{ key: 'alias.st', value: '1' }]
    expect(setConfigEntry(before, 'alias.ST', '2')).toEqual([{ key: 'alias.ST', value: '2' }])
    expect(before).toEqual([{ key: 'alias.st', value: '1' }])
  })
})

describe('п. 3: --get-regexp — нижний регистр шаблона, POSIX ERE (П7.71, П7.72)', () => {
  it('П7.71: все шаблоны блока дают вывод и код git', () => {
    replay(71)
  })

  it('П7.71: шаблоны в верхнем регистре находят строчные ключи (ALIAS, LG, ST$, alias\\.S, ^ALIAS\\.st$, Alias.LG)', () => {
    let state = fresh()
    state = runAll(state, ['git config --global alias.st status', 'git config --global alias.lg "log --oneline"', 'git config --global alias.St2 x'])
    for (const p of ["ALIAS", "LG", "'ST$'", "'alias\\.S'", "'^ALIAS\\.st$'", 'Alias.LG']) {
      const command = `git config --global --get-regexp ${p}`
      const r = expectGit(state, 71, command)
      expect(r.result.exitCode, command).toBe(0)
    }
  })

  it('П7.71: a{2 → error: invalid key pattern: a{2, код 6', () => {
    const state = runAll(fresh(), ['git config --global alias.st status'])
    const r = expectGit(state, 71, "git config --global --get-regexp 'a{2'")
    expect(r.result.exitCode).toBe(6)
  })

  it('П7.71: прежние совпадения не сломаны: alias\\.(st|lg), a+, *alias, +st, (, \\w+, [, nosuch', () => {
    const state = runAll(fresh(), ['git config --global alias.st status'])
    const codes: Record<string, number> = { "'alias\\.(st|lg)'": 0, "'a+'": 0, "'*alias'": 6, "'+st'": 6, "'('": 6, "'\\w+'": 0, "'['": 6, nosuch: 1 }
    for (const [p, code] of Object.entries(codes)) {
      const command = `git config --global --get-regexp ${p}`
      const e = fixBlock(71).find((x) => x.command === command || x.command === command.replace(/'a\+'/, '"a+"'))
      const r = run(state, command)
      expect(r.result.exitCode, command).toBe(code)
      if (e) expect(r.result.exitCode, command).toBe(e.exitCode)
    }
  })

  it('ключи в выводе в нижнем регистре, значение как набрано (П7.71: alias.st2 x для alias.St2)', () => {
    const state = runAll(fresh(), ['git config --global alias.St2 X'])
    expect(run(state, "git config --global --get-regexp 'ALIAS'").result.output).toBe('alias.st2 X')
  })

  it('П7.72: конструкции без прогона (\\b, \\<, \\B, обратные ссылки, [.a.], [=a=], a{300}, a}) — отказ области', () => {
    replay(72, (e) => (e.command === 'git config --global alias.st status' ? 'exact' : 'refused'))
  })

  it('compileEre: invalid и unsupported различаются', () => {
    expect(compileEre('a{2').kind).toBe('invalid')
    expect(compileEre('\\b').kind).toBe('unsupported')
    expect(compileEre('a{2,1}').kind).toBe('invalid')
    expect(compileEre('(a)(b)?').kind).toBe('ok')
  })
})

describe('п. 4: чтение пустого значения (П7.73)', () => {
  it('П7.73: пустое значение читается как одна пустая строка, код 0; нет ключа — пусто, код 1', () => {
    replay(73, (e) => (e.command.includes('|') ? 'skip' : 'exact'))
  })

  it('различие видно: «пусто, но есть» даёт вывод \\n и код 0, «нет ключа» — вывод пустой и код 1', () => {
    const state = runAll(fresh(), ['git config --global alias.q ""'])
    expect(run(state, 'git config --global alias.q').result).toMatchObject({ output: '\n', exitCode: 0, ok: true })
    expect(run(state, 'git config --global alias.nope').result).toMatchObject({ output: '', exitCode: 1, ok: false })
  })
})

describe('п. 5: формы вызова алиаса, ранее отказом области (П7.74–П7.76)', () => {
  it('П7.74: все команды блока: алиас на несуществующую команду, пустой с аргументами, самоссылка, цепочка a1 ↔ b1, git help', () => {
    replay(74)
  })

  it('П7.74: alias.x foo — git x и git x arg → expansion of alias failed, код 1', () => {
    const state = runAll(fresh(), ['git config --global alias.x foo'])
    for (const c of ['git x', 'git x arg']) expectGit(state, 74, c)
    expect(run(state, 'git x').result.output).toBe("expansion of alias 'x' failed; 'foo' is not a git command")
    expect(run(state, 'git x').state.missionsDone.aliasRun).toBe(false)
  })

  it('П7.74: git help для пустого, !-алиаса и самоссылки', () => {
    const state = runAll(fresh(), ['git config --global alias.q ""', 'git config --global alias.q2 "  "', 'git config --global alias.hi "!echo"', 'git config --global alias.loop loop'])
    for (const c of ['git help q', 'git help q2', 'git help hi', 'git help loop']) {
      const r = expectGit(state, 74, c)
      expect(r.result.exitCode).toBe(0)
    }
    expect(run(state, 'git help q2').result.output).toBe("'q2' is aliased to '  '")
  })

  it('П7.74: цепочка a1 → b1 → a1 печатает три строки, код 128', () => {
    const state = runAll(fresh(), ['git config --global alias.a1 b1', 'git config --global alias.b1 a1'])
    const r = run(state, 'git a1')
    expect(r.result.output).toBe("fatal: alias loop detected: expansion of 'a1' does not terminate:\n  a1 <==\n  b1 ==>")
    expect(r.result.exitCode).toBe(128)
  })

  it('П7.75: цепочки из трёх и с входом в петлю из середины', () => {
    replay(75)
  })

  it('П7.76: регистр в сообщениях: имя как набрано в «expansion of alias», в цепочке и в «recursive alias»', () => {
    replay(76)
  })

  it('П7.77: значение другого регистра — не команда: expansion of alias failed (git lo, git up)', () => {
    const state = runAll(fresh(), ['git config --global alias.lo LOG', 'git config --global alias.up "STATUS -s"'])
    expectGit(state, 77, 'git lo')
    expectGit(state, 77, 'git up')
  })

  it('П7.77: цепочка, которая кончается настоящей командой (git s2), — отказ области', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git config --global alias.s2 st'])
    const r = run(state, 'git s2')
    expect(r.result.output.startsWith(MARK)).toBe(true)
    expect(r.result.exitCode).toBeUndefined()
  })

  it('П7.78: git help для алиаса с именем настоящей команды — страница справки, отказ области', () => {
    const state = runAll(fresh(), ['git config --global alias.status log'])
    expect(run(state, 'git help status').result.output.startsWith(MARK)).toBe(true)
  })

  it('П7.74: git config get --global alias.nope → код 1; git config unset --global alias.nope → код 5', () => {
    expectGit(fresh(), 73, 'git config get --global alias.nope')
    expectGit(fresh(), 73, 'git config unset --global alias.nope')
  })
})

describe('п. 6: классы ключей (П7.79, П7.80) и речь', () => {
  const rejected = ['alias.a_b', 'alias.-x', 'alias.ab@c', 'alias.a/b', 'alias.1x']

  it('П7.79: все команды блока: запись, чтение, --get, --unset, подкоманды, локальные формы для отвергаемых ключей', () => {
    const state = replay(79)
    expect(state.globalConfig).toEqual([])
    expect(state.localConfig).toEqual([])
  })

  for (const key of rejected) {
    it(`П7.79: ${key} → error: invalid key, код 1, при записи и при чтении`, () => {
      for (const c of [`git config --global '${key}' status`, `git config --global '${key}'`, `git config --global --get '${key}'`, `git config --global --unset '${key}'`]) {
        const r = run(fresh(), c)
        expect(r.result.output, c).toBe(`error: invalid key: ${key}`)
        expect(r.result.exitCode, c).toBe(1)
        expect(r.state.globalConfig, c).toEqual([])
      }
    })
  }

  it('П7.79: alias. → error: key does not contain variable name: alias., запись и удаление код 2, чтение код 1', () => {
    expectGit(fresh(), 79, "git config --global 'alias.' status")
    expectGit(fresh(), 79, "git config --global 'alias.'")
    expectGit(fresh(), 79, "git config --global --unset 'alias.'")
    expect(run(fresh(), "git config --global 'alias.' status").result.exitCode).toBe(2)
    expect(run(fresh(), "git config --global 'alias.'").result.exitCode).toBe(1)
  })

  it('П7.80: alias.x-, alias.A-1, alias.a1 git принимает и тренажёр тоже; alias.a.b и alias.A.B (подсекция) — отказ области', () => {
    let state = fresh()
    for (const c of ['git config --global alias.x- status', 'git config --global alias.A-1 status', 'git config --global alias.a1 status']) {
      state = run(state, c).state
      expect(fixEntry(80, c).exitCode).toBe(0)
    }
    expectGit(state, 80, 'git config --global alias.x-')
    for (const c of ['git config --global alias.a.b status', 'git config --global alias.A.B status', 'git config --global alias.a.b']) {
      const r = run(state, c)
      expect(r.result.output.startsWith(MARK), c).toBe(true)
      expect(r.result.exitCode, c).toBeUndefined()
      expect(r.state.globalConfig, c).toEqual(state.globalConfig)
    }
  })

  it('П7.66: чтение недопустимого ключа без --global — тоже ошибка git, а не отказ области', () => {
    expectGit(fresh(), 66, 'git config alias.a_b')
    expectGit(fresh(), 66, 'git config --get alias.1x')
  })

  it('речь keyOutOfScope не утверждает, что git ключ примет; keySubsection называет подсекцию', () => {
    expect(ru.practices.config.keyOutOfScope('user.name')).not.toContain('git это умеет')
    expect(ru.practices.config.keySubsection('alias.a.b')).toContain('[alias "имя"]')
    expect(run(fresh(), 'git config --global user.name X').result.output).toContain('user.name')
  })

  it('речь invalidKeyNote перечисляет отвергаемое и не говорит, что «invalid key» бывает только при записи', () => {
    const note = ru.practices.config.invalidKeyNote
    for (const frag of ['Подчёркивание', '«@»', '«/»', 'пробел', '«!»']) expect(note).toContain(frag)
    expect(run(fresh(), 'git config --global --get alias.1x').result.explanation).toBe(note)
  })

  it('речь scopeRequired: без --global git читает оба файла, локальная запись побеждает', () => {
    const r = run(runAll(fresh(), ['git config --global alias.st status']), 'git config alias.st')
    expect(r.result.output.startsWith(MARK)).toBe(true)
    expect(r.result.output).toContain('оба файла')
    expect(r.result.output).toContain('побеждает запись из .git/config')
    expect(r.result.output).toContain('напечатает значение из ~/.gitconfig')
  })

  it('П7.66: чтение без --global, --list и git ST при одном имени в двух файлах — отказ области', () => {
    const state = runAll(fresh(), ['git config --global alias.st status', 'git config alias.st log'])
    for (const c of ['git config alias.st', 'git config --get alias.st', 'git config --get alias.st --global', 'git config --list', 'git ST']) {
      const r = run(state, c)
      expect(r.result.output.startsWith(MARK), c).toBe(true)
      expect(r.result.exitCode, c).toBeUndefined()
    }
  })
})
