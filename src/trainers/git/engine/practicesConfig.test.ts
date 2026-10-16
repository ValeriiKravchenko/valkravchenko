// Раздел 7, g18b2: `git config` для ключей alias.* — две записи (global и local), чтение, список,
// удаление, ошибки. Вывод и коды сверены с протоколом П7.25 (section7-git-runs.txt:967–1363) побайтно;
// остальное — отказы области (target.md, часть IX, «Что НЕ входит», строки 1510–1513).
import { describe, expect, it } from 'vitest'
import { fresh, protocolBlock, protocolEntry, run, runAll } from './practicesProtocolKit'
import type { ProtocolEntry } from './practicesProtocolKit'
import { formatConfigFile, setConfigEntry } from './practicesConfig'
import { getConfigEntries, getConfigFileText } from './practicesSection'

const MARK = '[тренажёр]'

/** Команды П7.25, которые движок выполняет сам и чей вывод не зависит от коммитов репозитория протокола. */
function isConfigCommand(e: ProtocolEntry): boolean {
  return /^git (config|help) /.test(e.command) && !e.command.includes('user.name') && !e.command.includes('2>&1')
}

describe('П7.25: git config — все команды протокола, подряд на одном состоянии', () => {
  // Запись local (`alias.zz "log -1"`) и чтение того же ключа идут в тот же прогон; `user.name` в разделе — отказ области (проверяется ниже).
  const entries = protocolBlock(25).filter((e) => isConfigCommand(e) || ['git q', 'git q2', 'git loop'].includes(e.command))

  it('в протоколе есть что сверять', () => {
    expect(entries).toHaveLength(40)
  })

  it('каждая команда: вывод, код возврата и ok как в протоколе', () => {
    let state = fresh()
    for (const e of entries) {
      const r = run(state, e.command)
      state = r.state
      const where = `П7.25, section7-git-runs.txt:${e.line}: ${e.command}`
      // `git config list --global` печатает ещё `user.name=X` (отказ области в разделе): эту строку из ожидания убираем.
      const expected = e.command === 'git config list --global' ? e.output.replace('\nuser.name=X', '') : e.output
      expect(r.result.output, where).toBe(expected)
      expect(r.result.exitCode, where).toBe(e.exitCode)
      expect(r.result.ok, where).toBe(e.exitCode === 0)
    }
  })

  it('два списка: global и local не смешиваются (section7-git-runs.txt:1102–1113)', () => {
    let state = fresh()
    state = run(state, 'git config --global alias.st status').state
    state = run(state, 'git config alias.zz "log -1"').state
    expect(getConfigEntries(state, 'global')).toEqual([{ key: 'alias.st', value: 'status' }])
    expect(getConfigEntries(state, 'local')).toEqual([{ key: 'alias.zz', value: 'log -1' }])
  })
})

describe('П7.25: файлы конфигов (cat), панели', () => {
  const finalState = () => {
    let state = fresh()
    for (const e of protocolBlock(25).filter((x) => /^git config (--global|set|unset|list)/.test(x.command) && !x.command.includes('user.name')))
      state = run(state, e.command).state
    return state
  }

  it('~/.gitconfig как в cat (section7-git-runs.txt:1321–1334), без секции [user]', () => {
    const cat = protocolEntry(25, 'cat ~/.gitconfig', 1)
    const withoutUser = cat.output.split('\n[user]')[0]
    expect(getConfigFileText(finalState(), 'global')).toBe(`${withoutUser}\n`)
  })

  it('первый cat ~/.gitconfig: одна запись (section7-git-runs.txt:981–984)', () => {
    const cat = protocolEntry(25, 'cat ~/.gitconfig', 0)
    expect(formatConfigFile([{ key: 'alias.st', value: 'status' }], false)).toBe(`${cat.output}\n`)
  })

  it('.git/config: [core] и затем [alias] (section7-git-runs.txt:1105–1113)', () => {
    const cat = protocolEntry(25, 'cat .git/config')
    const state = run(fresh(), 'git config alias.zz "log -1"').state
    expect(getConfigFileText(state, 'local')).toBe(`${cat.output}\n`)
  })

  it('в исходном состоянии ~/.gitconfig пуст, а .git/config — только [core] (target.md:1449)', () => {
    expect(getConfigFileText(fresh(), 'global')).toBe('')
    expect(getConfigFileText(fresh(), 'local')).toBe('[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n')
  })

  it('пустое значение записано как «q = », пробельное — в кавычках (section7-git-runs.txt:1327–1328)', () => {
    expect(formatConfigFile([{ key: 'alias.q', value: '' }, { key: 'alias.q2', value: '  ' }], false)).toBe('[alias]\n\tq = \n\tq2 = "  "\n')
  })
})

describe('запись: порядок и перезапись на месте', () => {
  it('П7.25: повторная запись alias.lg меняет значение, ключ остаётся первым (target.md:1460)', () => {
    let state = runAll(fresh(), ['git config --global alias.lg "log --oneline"', 'git config --global alias.st status'])
    state = run(state, 'git config --global alias.lg "log --oneline --graph"').state
    expect(getConfigEntries(state, 'global')).toEqual([
      { key: 'alias.lg', value: 'log --oneline --graph' },
      { key: 'alias.st', value: 'status' },
    ])
  })

  it('setConfigEntry не мутирует исходный список', () => {
    const before = [{ key: 'alias.a', value: '1' }]
    setConfigEntry(before, 'alias.a', '2')
    setConfigEntry(before, 'alias.b', '3')
    expect(before).toEqual([{ key: 'alias.a', value: '1' }])
  })

  it('set --global и запись без set дают один результат (section7-git-runs.txt:1315)', () => {
    const a = run(fresh(), 'git config set --global alias.br branch').state
    const b = run(fresh(), 'git config --global alias.br branch').state
    expect(a.globalConfig).toEqual(b.globalConfig)
  })

  it('запись молчит и возвращает код 0, пояснение называет файл', () => {
    const g = run(fresh(), 'git config --global alias.st status').result
    expect(g).toMatchObject({ output: '', exitCode: 0, ok: true })
    expect(g.explanation).toContain('~/.gitconfig')
    const l = run(fresh(), 'git config alias.st status').result
    expect(l.explanation).toContain('.git/config')
  })

  it('П7.25 (section7-git-runs.txt:1036–1046): alias.status log принимается, речь говорит о приоритете настоящей команды', () => {
    const r = run(fresh(), 'git config --global alias.status log')
    expect(r.result.exitCode).toBe(0)
    expect(r.result.explanation).toContain('приоритет')
    expect(r.state.globalConfig).toEqual([{ key: 'alias.status', value: 'log' }])
  })

  it('П7.25 (section7-git-runs.txt:1135–1147): пустое значение и значение из пробелов принимаются, код 0', () => {
    const s = runAll(fresh(), ['git config --global alias.q ""', 'git config --global alias.q2 "  "'])
    expect(s.globalConfig).toEqual([{ key: 'alias.q', value: '' }, { key: 'alias.q2', value: '  ' }])
  })

  it('П7.25 (section7-git-runs.txt:1022): значение с «!» принимается, речь называет оболочку', () => {
    const r = run(fresh(), `git config --global alias.hi '!echo'`)
    expect(r.result.exitCode).toBe(0)
    expect(r.result.explanation).toContain('оболочк')
  })

  it('имя с дефисом допустимо (section7-git-runs.txt:1169)', () => {
    expect(run(fresh(), 'git config --global alias.st-short "status -s"').result.exitCode).toBe(0)
  })
})

describe('ошибки git при записи', () => {
  for (const name of ['1x', '_x', 'bad!name']) {
    it(`П7.25: alias.${name} → error: invalid key, код 1, конфиг не меняется`, () => {
      const e = protocolBlock(25).find((x) => x.command === `git config --global alias.${name} status`)
      expect(e, name).toBeDefined()
      const r = run(fresh(), `git config --global alias.${name} status`)
      expect(r.result.output).toBe(e?.output)
      expect(r.result.exitCode).toBe(1)
      expect(r.state.globalConfig).toEqual([])
    })
  }

  it('П7.25 (section7-git-runs.txt:1189): "alias.a b" → error: invalid key: alias.a b', () => {
    const r = run(fresh(), 'git config --global "alias.a b" status')
    expect(r.result.output).toBe('error: invalid key: alias.a b')
    expect(r.result.exitCode).toBe(1)
  })

  it('П7.25 (section7-git-runs.txt:1231–1292): неизвестная длинная опция → error + полный usage, код 129', () => {
    const e = protocolEntry(25, 'git config --global --foo')
    const r = run(fresh(), 'git config --global --foo')
    expect(r.result.output).toBe(e.output)
    expect(r.result.exitCode).toBe(129)
    expect(r.result.ok).toBe(false)
  })

  it('П7.25 (section7-git-runs.txt:1294–1296): git config --global без действия → error: no action specified, код 129', () => {
    const r = run(fresh(), 'git config --global')
    expect(r.result.output).toBe('error: no action specified')
    expect(r.result.exitCode).toBe(129)
  })
})

describe('чтение, список, удаление: коды возврата (target.md:1495–1500)', () => {
  const base = () => runAll(fresh(), ['git config --global alias.st status', 'git config --global alias.lg "log --oneline"'])

  it('чтение существующего: значение, код 0', () => {
    for (const cmd of ['git config --global alias.st', 'git config --global --get alias.st', 'git config get --global alias.st']) {
      expect(run(base(), cmd).result).toMatchObject({ output: 'status', exitCode: 0, ok: true })
    }
  })

  it('чтение отсутствующего: пусто, код 1 (section7-git-runs.txt:1080–1084)', () => {
    for (const cmd of ['git config --global alias.zz', 'git config --global --get alias.zz']) {
      expect(run(base(), cmd).result).toMatchObject({ output: '', exitCode: 1, ok: false })
    }
  })

  it('--get-regexp: совпадения в порядке записи, код 0; без совпадений код 1; "[" — код 6 (section7-git-runs.txt:1207–1229)', () => {
    expect(run(base(), 'git config --global --get-regexp alias').result).toMatchObject({ output: 'alias.st status\nalias.lg log --oneline', exitCode: 0 })
    expect(run(base(), 'git config --global --get-regexp "^alias\\.l"').result.output).toBe('alias.lg log --oneline')
    expect(run(base(), 'git config --global --get-regexp nosuch').result).toMatchObject({ output: '', exitCode: 1 })
    expect(run(base(), 'git config --global --get-regexp "["').result).toMatchObject({ output: 'error: invalid key pattern: [', exitCode: 6 })
  })

  it('--list, -l, list --global: ключ=значение, код 0', () => {
    for (const cmd of ['git config --global --list', 'git config --global -l', 'git config list --global']) {
      expect(run(base(), cmd).result).toMatchObject({ output: 'alias.st=status\nalias.lg=log --oneline', exitCode: 0 })
    }
  })

  it('пустой ~/.gitconfig: список пуст, код 0 (в протоколе пустого списка нет — по таблице кодов, target.md:1495)', () => {
    expect(run(fresh(), 'git config --global --list').result).toMatchObject({ output: '', exitCode: 0 })
  })

  it('--unset существующего: код 0, запись исчезает; отсутствующего: код 5 (section7-git-runs.txt:1086–1090)', () => {
    const r = run(base(), 'git config --global --unset alias.st')
    expect(r.result).toMatchObject({ output: '', exitCode: 0 })
    expect(r.state.globalConfig).toEqual([{ key: 'alias.lg', value: 'log --oneline' }])
    expect(run(base(), 'git config --global --unset alias.zz').result).toMatchObject({ output: '', exitCode: 5, ok: false })
    expect(run(base(), 'git config unset --global alias.st').state.globalConfig).toHaveLength(1)
  })
})

describe('отказы области (target.md:1510–1513)', () => {
  function refused(line: string, state = fresh()) {
    const r = run(state, line)
    expect(r.result.output.startsWith(MARK), line).toBe(true)
    expect(r.result.exitCode, line).toBeUndefined()
    expect(r.result.ok).toBe(false)
    expect(r.state.globalConfig, line).toEqual(state.globalConfig)
    expect(r.state.localConfig, line).toEqual(state.localConfig)
    return r.result.output
  }

  it('другие ключи: user.name, core.*', () => {
    expect(refused('git config --global user.name X')).toContain('user.name')
    refused('git config --global user.name')
    refused('git config core.editor vim')
  })

  it('--system, --file, --edit, --show-origin, --add, --replace-all и их сокращения — не «unknown option»', () => {
    for (const opt of ['--system', '--file=x', '--edit', '--show-origin', '--add', '--replace-all', '-e', '-f', '--glo', '--lis', '--local']) {
      refused(`git config ${opt} --global alias.st status`)
    }
  })

  it('rename-section, remove-section, edit', () => {
    for (const sub of ['rename-section', 'remove-section', 'edit']) refused(`git config ${sub} --global a b`)
  })

  it('чтение, список и удаление без --global', () => {
    const state = run(fresh(), 'git config alias.zz "log -1"').state
    for (const line of ['git config alias.zz', 'git config --get alias.zz', 'git config --list', 'git config -l', 'git config --get-regexp alias', 'git config get alias.zz', 'git config list']) {
      refused(line, state)
    }
  })

  it('git config без аргументов и set без --global', () => {
    refused('git config')
    refused('git config set alias.a b')
  })

  it('значение из нескольких слов без кавычек: речь называет шелл (target.md, место 13)', () => {
    // g18b3: после первого слова опции и слова — значение и шаблон значения (П7.62, П7.64); ответ даёт git, речь называет шелл.
    for (const line of ['git config --global alias.lg log --oneline --graph', 'git config --global alias.lg log extra', 'git config alias.lg log extra']) {
      const r = run(fresh(), line).result
      expect(`${r.output} ${r.explanation}`, line).toContain('шелл')
    }
  })

  it('значение с кавычками или обратной косой чертой', () => {
    refused(`git config --global alias.x "echo 'a'"`)
    refused('git config --global alias.x "a\\\\b"')
  })

  it('имя с точкой (секция [alias "a"]) — отказ области; заглавные и «alias.» теперь ответ git (g18b3)', () => {
    refused('git config --global alias.a.b status')
  })

  it('чтение недопустимого имени, --get-regexp с двумя аргументами, пустой шаблон, повтор ключа', () => {
    refused('git config --global --get-regexp a b')
    refused('git config --global --get-regexp ""')
    refused('git config --global --global alias.st status')
    refused('git config --global --get --unset alias.st')
    refused('git config --global -x')
  })

  it('отказ не добавляет записей и не трогает рабочий каталог', () => {
    const s = fresh()
    const r = run(s, 'git config --global user.name X')
    expect(r.state.working).toEqual(s.working)
    expect(r.state.index).toEqual(s.index)
  })
})

describe('история и неизменяемость', () => {
  it('исходное состояние не мутируется командой записи', () => {
    const s = fresh()
    const snapshot = JSON.stringify(s)
    run(s, 'git config --global alias.st status')
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('команда попадает в историю с кодом ok', () => {
    const r = run(fresh(), 'git config --global --unset alias.zz')
    expect(r.state.history.at(-1)).toMatchObject({ kind: 'command', input: 'git config --global --unset alias.zz', ok: false })
  })
})
