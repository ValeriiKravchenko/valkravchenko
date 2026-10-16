// Раздел 7, поток g18a: диспетчер, границы области, переходы состояния и коды возврата.
// Построчная сверка вывода с протоколом — practicesProtocol.test.ts; здесь то, чего в протоколе
// нет дословно: отказы области, состояние после команд, история, коды возврата из таблицы
// части IX (target.md:1493–1500).
import { describe, expect, it } from 'vitest'
import { createPracticesSection, runPracticesCommand, writeGitignore } from './practicesSection'
import type { PracticesState } from './practicesSection'

const MARK = '[тренажёр]'

function run(state: PracticesState, line: string) {
  const r = runPracticesCommand(state, line)
  if (r.result === null) throw new Error('пустая строка')
  return { state: r.state, result: r.result }
}

const fresh = () => createPracticesSection()
const withRules = (rules: string) => writeGitignore(fresh(), rules)

function expectRefusal(state: PracticesState, line: string, needle?: string) {
  const { state: next, result } = run(state, line)
  expect(result.output.startsWith(MARK), line).toBe(true)
  expect(result.exitCode, line).toBeUndefined()
  expect(result.ok).toBe(false)
  if (needle) expect(result.output).toContain(needle)
  // отказ области не меняет ни рабочий каталог, ни индекс, ни конфиги
  expect(next.working).toEqual(state.working)
  expect(next.index).toEqual(state.index)
  expect(next.globalConfig).toEqual([])
  expect(next.localConfig).toEqual([])
}

describe('исходное состояние', () => {
  it('master, коммитов нет, 14 файлов и .gitignore из четырёх строк, индекс и конфиги пусты (target.md:1436–1450)', () => {
    const s = fresh()
    expect(s.branch).toBe('master')
    expect(Object.keys(s.working)).toHaveLength(15)
    expect(s.working['.gitignore']).toBe('*.log\nnode_modules/\n.env*\nbuild/\n')
    expect(s.index).toEqual({})
    expect(s.globalConfig).toEqual([])
    expect(s.localConfig).toEqual([])
    expect(s.history).toEqual([])
    expect('commits' in s).toBe(false)
  })

  it('пути с каталогами: каталог существует, пока в нём есть файл', () => {
    expect(fresh().working).toHaveProperty(['packages/ui/node_modules/x.js'])
  })
})

describe('диспетчер', () => {
  it('пустая и пробельная строка: результат null, состояние то же', () => {
    const s = fresh()
    expect(runPracticesCommand(s, '')).toEqual({ state: s, result: null })
    expect(runPracticesCommand(s, '   ').result).toBeNull()
  })

  it('каждая команда попадает в историю с вводом и выводом', () => {
    const { state } = run(fresh(), 'git status -s')
    expect(state.history).toHaveLength(1)
    expect(state.history[0]).toMatchObject({ kind: 'command', input: 'git status -s', ok: true })
  })

  it('П7.25 (section7-git-runs.txt:968–976): неизвестная подкоманда — первая строка git, код 1', () => {
    const { result } = run(fresh(), 'git st')
    expect(result.output).toBe("git: 'st' is not a git command. See 'git --help'.")
    expect(result.exitCode).toBe(1)
    expect(result.ok).toBe(false)
  })

  it('настоящая команда вне области раздела — отказ области, а не «is not a git command»', () => {
    // g18b2: log, config, commit -m, help теперь в области (practicesConfig.test.ts, practicesLog.test.ts и др.)
    expectRefusal(fresh(), 'git branch', 'git branch')
    expectRefusal(fresh(), 'git stash')
    expectRefusal(fresh(), 'git commit -m "x"')
  })

  it('git без подкоманды и глобальная опция git — отказ области', () => {
    expectRefusal(fresh(), 'git')
    expectRefusal(fresh(), 'git --version')
  })

  it('не git: оболочка не выполняется', () => {
    expectRefusal(fresh(), 'ls')
  })

  it('конструкции bash и маски получают отказ шелла до git', () => {
    expectRefusal(fresh(), 'git status; ls')
    expectRefusal(fresh(), 'git add *.log')
    expectRefusal(fresh(), 'git status "')
  })
})

describe('git status: формы и отказы', () => {
  it('ключи в любом порядке дают тот же вывод', () => {
    const a = run(fresh(), 'git status --short --ignored -uall').result.output
    expect(run(fresh(), 'git status -uall --ignored -s').result.output).toBe(a)
    expect(run(fresh(), 'git status --ignored --short -uall').result.output).toBe(a)
    expect(run(fresh(), 'git status --short').result.output).toBe(run(fresh(), 'git status -s').result.output)
  })

  it('код возврата 0 (target.md:1495)', () => {
    expect(run(fresh(), 'git status').result.exitCode).toBe(0)
    expect(run(fresh(), 'git status').result.ok).toBe(true)
  })

  it('формы вне области: другие ключи, повтор ключа, -uno, --ignored=…, кластер, справка, длинный формат с --ignored или -uall', () => {
    for (const line of [
      'git status -uno',
      'git status --ignored=traditional',
      'git status -sb',
      'git status -h',
      'git status --porcelain',
      'git status -s -s',
      'git status -s --short',
      'git status --ignored',
      'git status -uall',
      'git status -s -uall',
      'git status --untracked-files=all',
    ]) {
      expectRefusal(fresh(), line, 'git status')
    }
  })

  it('путь в status: только git status --short <файл из индекса>', () => {
    expectRefusal(fresh(), 'git status app.js')
    expectRefusal(fresh(), 'git status --short app.js')
    expectRefusal(fresh(), 'git status --short --ignored debug.log')
  })

  it('правка .gitignore действует на status сразу, без коммита (target.md:1478–1500)', () => {
    const before = run(withRules(''), 'git status -s').result.output
    expect(before).toContain('?? build/')
    expect(before).toContain('?? .env')
    const after = run(writeGitignore(withRules(''), 'build/\n'), 'git status -s').result.output
    expect(after).not.toContain('build')
    expect(after).toContain('?? .env')
  })

  it('все файлы игнорируются: вывода без «??» нет в прогонах — отказ области', () => {
    expectRefusal(withRules('*\n'), 'git status', 'игнорируют все файлы')
    expectRefusal(withRules('*\n'), 'git status -s')
  })

  it('смешанный каталог build/ (П7.34): «?? build/» и отдельная строка игнорируемого файла', () => {
    const { result } = run(withRules('build/*\n!build/output.map\n'), 'git status --short --ignored')
    expect(result.output).toContain('?? build/\n')
    expect(result.output.endsWith('!! build/bundle.js')).toBe(true)
  })

  it('речь тренажёра: «!» в игнорируемом каталоге объясняется пояснением, вывод git не меняется (target.md:1569)', () => {
    const { result } = run(withRules('build/\n!build/output.map\n'), 'git status --short --ignored')
    expect(result.explanation).toContain('build')
    expect(result.explanation).toContain('build/*')
    expect(run(fresh(), 'git status').result.explanation).toBeNull()
  })
})

describe('речь тренажёра: совет при «!» внутри игнорируемого каталога', () => {
  // П7.53: при build/* каталог build/sub игнорируется правилом build/*, совет build/* ничего не меняет
  it('П7.53: build/* + !build/sub/x — совет называет правило каталога и «!build/sub/», а не build/*', () => {
    const state = withRules('build/*\n!build/sub/x\n')
    const files = { ...state.working, 'build/sub/x': 'x', 'build/sub/y': 'y' }
    const withSub = { ...state, working: files }
    const { result } = run(withSub, 'git check-ignore -v build/sub/x')
    expect(result.output).toBe('.gitignore:1:build/*\tbuild/sub/x')
    expect(result.exitCode).toBe(0)
    expect(result.explanation).toContain('игнорируется правилом «build/*»')
    expect(result.explanation).toContain('!build/sub/')
    expect(result.explanation).not.toContain('например build/*')
    const status = run(withSub, 'git status --short --ignored -uall').result
    expect(status.explanation).toContain('!build/sub/')
  })

  it('П7.8: build/ + !build/output.map — совет прежний: игнорировать содержимое, build/*', () => {
    const { result } = run(withRules('build/\n!build/output.map\n'), 'git check-ignore -v build/output.map')
    expect(result.explanation).toContain('например build/*')
    expect(result.explanation).toContain('правило «build/»')
  })
})

describe('git check-ignore: формы, коды возврата, отказы', () => {
  it('П7.16/П7.18/П7.20: код 1, если ничего не игнорируется; вывод --non-matching остаётся', () => {
    const { result } = run(withRules(''), 'git check-ignore -v --non-matching app.js')
    expect(result.output).toBe('::\tapp.js')
    expect(result.exitCode).toBe(1)
    expect(result.ok).toBe(false)
  })

  it('без --non-matching строк «::» нет: пустой вывод, код 1 (target.md:1604)', () => {
    const { result } = run(fresh(), 'git check-ignore -v app.js')
    expect(result.output).toBe('')
    expect(result.exitCode).toBe(1)
  })

  it('код 0, если игнорируется хотя бы один путь; строки идут в порядке аргументов (П7.1)', () => {
    const { result } = run(fresh(), 'git check-ignore -v --non-matching src/build.js debug.log app.js')
    expect(result.output).toBe('::\tsrc/build.js\n.gitignore:1:*.log\tdebug.log\n::\tapp.js')
    expect(result.exitCode).toBe(0)
    expect(result.ok).toBe(true)
  })

  it('ключи в любом порядке: --verbose, --non-matching перед -v', () => {
    const a = run(fresh(), 'git check-ignore -v --non-matching debug.log').result.output
    expect(run(fresh(), 'git check-ignore --non-matching -v debug.log').result.output).toBe(a)
    expect(run(fresh(), 'git check-ignore --verbose --non-matching debug.log').result.output).toBe(a)
  })

  it('П7.6 (section7-git-runs.txt:218–220): строка с «!» печатается с --non-matching; пояснение говорит, что файл не игнорируется', () => {
    const { result } = run(withRules('*.log\n!important.log\n'), 'git check-ignore -v --non-matching debug.log important.log')
    expect(result.output).toBe('.gitignore:1:*.log\tdebug.log\n.gitignore:2:!important.log\timportant.log')
    expect(result.exitCode).toBe(0)
    expect(result.explanation).toContain('!important.log')
  })

  it('П7.8: для файла в игнорируемом каталоге названо правило каталога, пояснение про «!» от тренажёра', () => {
    const { result } = run(withRules('build/\n!build/output.map\n'), 'git check-ignore -v build/output.map')
    expect(result.output).toBe('.gitignore:1:build/\tbuild/output.map')
    expect(result.exitCode).toBe(0)
    expect(result.explanation).toContain('build/*')
  })

  it('П7.23: без пути — fatal: no path specified, код 128', () => {
    const { result } = run(fresh(), 'git check-ignore')
    expect(result.output).toBe('fatal: no path specified')
    expect(result.exitCode).toBe(128)
  })

  it('отказ области: ключи вне формы, с ключами без пути, -n, -q, --stdin, --no-index, -- и справка', () => {
    for (const line of [
      'git check-ignore -v',
      'git check-ignore -v --non-matching',
      'git check-ignore -n debug.log',
      'git check-ignore -vn debug.log',
      'git check-ignore -q debug.log',
      'git check-ignore -v --stdin',
      'git check-ignore -v --no-index app.js',
      'git check-ignore -v -- debug.log',
      'git check-ignore -h',
      'git check-ignore -v -v debug.log',
      'git check-ignore -v --non-matching --non-matching debug.log',
    ]) {
      expectRefusal(fresh(), line, 'git check-ignore')
    }
  })

  it('отказ области: несуществующий путь, каталог, маска, ./путь', () => {
    expectRefusal(fresh(), 'git check-ignore -v nosuch.txt')
    expectRefusal(fresh(), 'git check-ignore -v build')
    expectRefusal(fresh(), 'git check-ignore -v build/')
    expectRefusal(fresh(), 'git check-ignore -v ./debug.log')
    expectRefusal(fresh(), 'git check-ignore -v *.log')
  })

  // П7.51 (section7-gitignore-fixes-git-runs.txt): правило с «!» и коды возврата
  it('П7.51: -v с совпавшим правилом «!» — строка правила и код 0', () => {
    const { result } = run(withRules('*.log\n!important.log\n'), 'git check-ignore -v important.log')
    expect(result.output).toBe('.gitignore:2:!important.log\timportant.log')
    expect(result.exitCode).toBe(0)
    expect(result.explanation).toContain('!important.log')
  })

  it('П7.51: -v с игнорируемым путём и путём с «!» — строки правил 1 и 2, код 0', () => {
    const { result } = run(withRules('*.log\n!important.log\n'), 'git check-ignore -v debug.log important.log')
    expect(result.output).toBe('.gitignore:1:*.log\tdebug.log\n.gitignore:2:!important.log\timportant.log')
    expect(result.exitCode).toBe(0)
  })

  it('П7.51: только правила «!», -v --non-matching — строка с «!» и «::», код 0', () => {
    const { result } = run(withRules('!important.log\n'), 'git check-ignore -v --non-matching important.log build/bundle.js')
    expect(result.output).toBe('.gitignore:1:!important.log\timportant.log\n::\tbuild/bundle.js')
    expect(result.exitCode).toBe(0)
    expect(run(withRules('*.log\n!important.log\n'), 'git check-ignore -v --non-matching important.log build/bundle.js').result.output).toBe(
      '.gitignore:2:!important.log\timportant.log\n::\tbuild/bundle.js',
    )
  })

  it('П7.51: только правила «!», -v без --non-matching — строка с «!», код 0; путь без правила — пусто, код 1', () => {
    const state = withRules('!important.log\n')
    const a = run(state, 'git check-ignore -v important.log')
    expect(a.result.output).toBe('.gitignore:1:!important.log\timportant.log')
    expect(a.result.exitCode).toBe(0)
    const b = run(state, 'git check-ignore -v important.log debug.log')
    expect(b.result.output).toBe('.gitignore:1:!important.log\timportant.log')
    expect(b.result.exitCode).toBe(0)
    const c = run(state, 'git check-ignore -v build/bundle.js')
    expect(c.result.output).toBe('')
    expect(c.result.exitCode).toBe(1)
  })

  it('П7.51: без -v путь с правилом «!» — пусто, код 1; игнорируемый путь печатается как есть, код 0', () => {
    const state = withRules('*.log\n!important.log\n')
    const a = run(state, 'git check-ignore important.log')
    expect(a.result.output).toBe('')
    expect(a.result.exitCode).toBe(1)
    expect(a.result.explanation).toBeNull()
    expect(run(state, 'git check-ignore debug.log').result.output).toBe('debug.log')
    const b = run(state, 'git check-ignore debug.log important.log')
    expect(b.result.output).toBe('debug.log')
    expect(b.result.exitCode).toBe(0)
    expect(run(withRules('!important.log\n'), 'git check-ignore important.log').result.exitCode).toBe(1)
  })

  it('П7.52: без -v файл в игнорируемом каталоге печатается своим путём; неигнорируемый — код 1', () => {
    const state = withRules('build/\n*.log\n')
    expect(run(state, 'git check-ignore build/bundle.js').result.output).toBe('build/bundle.js')
    const r = run(state, 'git check-ignore app.js debug.log build/bundle.js').result
    expect(r.output).toBe('debug.log\nbuild/bundle.js')
    expect(r.exitCode).toBe(0)
    expect(run(state, 'git check-ignore app.js').result.exitCode).toBe(1)
  })

  it('П7.52: --non-matching без -v — fatal, код 128 (слово git, не отказ области)', () => {
    const { result } = run(fresh(), 'git check-ignore --non-matching app.js')
    expect(result.output).toBe('fatal: --non-matching is only valid with --verbose')
    expect(result.exitCode).toBe(128)
  })

  it('П7.52: --verbose без --non-matching печатает правило', () => {
    expect(run(fresh(), 'git check-ignore --verbose debug.log').result.output).toBe('.gitignore:1:*.log\tdebug.log')
  })

  it('отслеживаемый файл (после add -f): отказ области', () => {
    const { state } = run(fresh(), 'git add -f debug.log')
    expectRefusal(state, 'git check-ignore -v debug.log', 'отслеживается')
  })

  it('.gitignore — обычный файл рабочего каталога: его вердикт считается как у остальных', () => {
    const { result } = run(withRules('.git*\n'), 'git check-ignore -v .gitignore')
    expect(result.output).toBe('.gitignore:1:.git*\t.gitignore')
  })
})

describe('git add: игнорируемый файл и -f', () => {
  it('отказ: код 1, состояние не меняется, пояснение называет -f', () => {
    const start = fresh()
    const { state, result } = run(start, 'git add debug.log')
    expect(result.exitCode).toBe(1)
    expect(result.ok).toBe(false)
    expect(state.index).toEqual({})
    expect(result.explanation).toContain('-f')
  })

  it('П7.22: -f в любом месте, --force — то же; файл попадает в индекс с содержимым рабочего каталога, код 0', () => {
    for (const line of ['git add -f debug.log', 'git add debug.log -f', 'git add --force debug.log']) {
      const { state, result } = run(fresh(), line)
      expect(result.output, line).toBe('')
      expect(result.exitCode, line).toBe(0)
      expect(result.ok).toBe(true)
      expect(Object.keys(state.index)).toEqual(['debug.log'])
      expect(state.index['debug.log']).toBe(state.working['debug.log'])
    }
  })

  it('П7.22: add -f файла внутри игнорируемого каталога — индекс получает путь файла', () => {
    const { state } = run(fresh(), 'git add -f build/bundle.js')
    expect(Object.keys(state.index)).toEqual(['build/bundle.js'])
  })

  it('П7.22: отказ для файла в каталоге называет каталог; для вложенного — полный путь каталога', () => {
    expect(run(fresh(), 'git add docs/build/index.html').result.output.split('\n')[1]).toBe('docs/build')
    expect(run(fresh(), 'git add packages/ui/node_modules/x.js').result.output.split('\n')[1]).toBe('packages/ui/node_modules')
  })

  it('правка .gitignore действует на add сразу', () => {
    expect(run(withRules(''), 'git add debug.log').result.ok).toBe(false)
    // правило ушло, файл не игнорируется: add обычного файла вне области
    expectRefusal(withRules(''), 'git add debug.log', 'не игнорируется')
  })

  it('add -f не игнорируемого файла и add обычного файла — отказ области', () => {
    expectRefusal(fresh(), 'git add app.js', 'не игнорируется')
    expectRefusal(fresh(), 'git add -f app.js', 'не игнорируется')
    expectRefusal(withRules('*.log\n!important.log\n'), 'git add -f important.log')
  })

  it('отказ области: ., -A, *, несколько путей, каталог, несуществующий путь, лишние ключи, --', () => {
    for (const line of [
      'git add .',
      'git add -A',
      'git add *',
      'git add debug.log app.js',
      'git add -f debug.log important.log',
      'git add build',
      'git add nosuch.txt',
      'git add -n debug.log',
      'git add -f -f debug.log',
      'git add -- debug.log',
      'git add',
      'git add -f',
    ]) {
      expectRefusal(fresh(), line, 'git add')
    }
  })

  it('повторный add того же файла после -f — отказ области, индекс не меняется', () => {
    const { state } = run(fresh(), 'git add -f debug.log')
    expectRefusal(state, 'git add debug.log', 'уже в индексе')
    expectRefusal(state, 'git add -f debug.log', 'уже в индексе')
  })
})

describe('status после git add -f', () => {
  const staged = () => run(fresh(), 'git add -f debug.log').state

  it('П7.22: git status --short debug.log → «A  debug.log», код 0', () => {
    const { result } = run(staged(), 'git status --short debug.log')
    expect(result.output).toBe('A  debug.log')
    expect(result.exitCode).toBe(0)
    expect(run(staged(), 'git status -s debug.log').result.output).toBe('A  debug.log')
  })

  it('прочие формы status при непустом индексе — отказ области (вывод с подготовленными файлами не сверен)', () => {
    for (const line of ['git status', 'git status -s', 'git status --short --ignored', 'git status --short --ignored -uall']) {
      expectRefusal(staged(), line, 'индексе')
    }
  })

  it('путь не из индекса — отказ области', () => {
    expectRefusal(staged(), 'git status --short app.js')
    expectRefusal(staged(), 'git status debug.log')
  })
})

describe('отказы не подделывают git', () => {
  it('отказ области начинается с метки тренажёра, а вывод git — нет', () => {
    const git = run(fresh(), 'git add debug.log').result.output
    expect(git.startsWith(MARK)).toBe(false)
    expect(run(fresh(), 'git add .').result.output.startsWith(MARK)).toBe(true)
  })
})
