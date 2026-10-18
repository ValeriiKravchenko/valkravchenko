// Диспетчер раздела 8: шелл и git-сторона, граница области, история терминала.
import { describe, expect, it } from 'vitest'
import { executeAppendixCommand } from './appendixCommands'
import { fresh, run, runAll } from './appendixProtocolKit'
import { createFile } from './appendixFileOps'
import { ru } from '../locales/ru'

const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)

describe('пустая строка', () => {
  it('не меняет состояние, результат null', () => {
    const s = fresh()
    for (const line of ['', '   ', '\t']) {
      const r = executeAppendixCommand(s, line)
      expect(r.result, JSON.stringify(line)).toBeNull()
      expect(r.state).toBe(s)
    }
  })
})

describe('история терминала', () => {
  it('каждая выполненная строка попадает в историю как есть: ввод, ok, вывод, пояснение', () => {
    const s = runAll(fresh(), ['git tag v1', '  git   status  '])
    expect(s.history).toHaveLength(2)
    expect(s.history[0]).toMatchObject({ kind: 'command', input: 'git tag v1', ok: true, output: '' })
    expect(s.history[1]).toMatchObject({ kind: 'command', input: '  git   status  ', ok: true })
  })

  it('отказ git и отказ области тоже записываются, с ok=false', () => {
    const s = runAll(fresh(), ['git tag "a b"', 'git rebase master'])
    expect(s.history.map((h) => h.kind === 'command' && h.ok)).toEqual([false, false])
  })
})

describe('шелл', () => {
  it('не git: bash: command not found в виде речи тренажёра', () => {
    const r = run(fresh(), 'ls').result
    expect(r.output).toBe(ru.errors.bashCommandNotFound('ls'))
    expect(r.exitCode).toBeUndefined()
  })

  it('операторы, подстановки и незакрытая кавычка — отказ шелла до разбора git', () => {
    for (const line of ['git tag v1 && git tag v2', 'git log | cat', 'git tag $(echo x)', 'git tag "unclosed', 'git tag a\\b', 'git tag ~']) {
      const r = run(fresh(), line)
      refusal(r.result.output)
      expect(r.state.tags, line).toEqual({})
    }
  })

  it('незакавыченная маска, под которую подошёл бы файл рабочего каталога, — отказ; без подходящих файлов маска идёт в git как есть (П8.2: git tag -l v1.1*)', () => {
    const s = runAll(fresh(), ['git tag v1.1.0'])
    expect(run(s, 'git tag -l v1.1*').result.output).toBe('v1.1.0')
    const r = run(s, 'git add *.js').result
    expect(r.output).toBe(ru.errors.shellGlobUnsupported('*.js'))
    expect(r.exitCode).toBeUndefined()
  })

  it('скрытый файл маска без точки не раскрывает: слово идёт в git как есть; обычный файл — отказ', () => {
    const base = fresh()
    const hidden = { ...base, working: { ...base.working, '.hid': 'x\n' } }
    expect(run(hidden, 'git tag -l *hid').result.exitCode).toBe(0)
    const visible = { ...base, working: { ...base.working, 'a.hid': 'x\n' } }
    expect(run(visible, 'git tag -l *hid').result.output).toBe(ru.errors.shellGlobUnsupported('*hid'))
  })

  it('маска с обратной косой в слове разбирается шеллом как отказ, а не как маска', () => {
    refusal(run(fresh(), 'git tag -l a\\*').result.output)
  })

  it('маска с классом в тегах и закавыченная маска не трогаются шеллом', () => {
    const s = runAll(fresh(), ['git tag v1', 'git tag v2'])
    expect(run(s, 'git tag -l "v[1-2]"').result.output).toBe('v1\nv2')
    expect(run(s, 'git tag -l v[1-2]').result.output).toBe('v1\nv2')
  })

  it('голая * раскрывается именами файлов рабочего каталога: git add * подготавливает всё видимое', () => {
    const s = createFile(fresh(), 'x.txt')
    const r = run(s, 'git add *')
    expect(r.result.exitCode).toBe(0)
    expect(r.state.index['x.txt']).toBe('новый файл\n')
  })

  it('кавычки снимаются шеллом: сообщение коммита из нескольких слов', () => {
    const s = fresh()
    const edited = { ...s, working: { ...s.working, 'app.js': 'q\n' } }
    const after = run(edited, 'git commit -am "Две части сообщения"').state
    expect(after.commits[after.branches.master].message).toBe('Две части сообщения')
  })
})

describe('git без подкоманды, глобальные ключи, неизвестные и настоящие команды', () => {
  it('git без подкоманды — отказ области', () => {
    const r = run(fresh(), 'git').result
    expect(r.output).toBe(ru.appendix.errors.gitUsageNoArgs)
    expect(r.exitCode).toBeUndefined()
  })

  it('глобальные ключи git (--version, -c, -C, --help) — отказ области', () => {
    for (const line of ['git --version', 'git -c log.decorate=auto log', 'git -C . status', 'git --help']) {
      const r = run(fresh(), line).result
      expect(r.output, line).toBe(ru.appendix.errors.commandOutOfScope(line.split(' ')[1]))
      expect(r.exitCode).toBeUndefined()
    }
  })

  it("несуществующая команда: git: '…' is not a git command, код 1", () => {
    const r = run(fresh(), 'git nosuchcmd').result
    expect(r.output).toBe("git: 'nosuchcmd' is not a git command. See 'git --help'.")
    expect(r.exitCode).toBe(1)
    expect(r.ok).toBe(false)
  })

  it('команды шага B, конфликты и сервера — отказ области с названием команды', () => {
    for (const name of ['cherry-pick', 'reflog', 'rebase', 'reset', 'switch', 'restore', 'merge', 'bisect', 'push', 'pull', 'clone', 'init', 'config', 'rm', 'mv', 'revert', 'show-ref', 'cat-file']) {
      const r = run(fresh(), `git ${name}`)
      expect(r.result.output, name).toBe(ru.appendix.errors.commandOutOfScope(name))
      expect(r.result.exitCode).toBeUndefined()
      expect(r.state.branches).toEqual(fresh().branches)
    }
  })

  it('отказ области всегда начинается с метки тренажёра и не подделывает вывод git', () => {
    for (const line of ['git rebase master', 'git cherry-pick HEAD', 'git reflog', 'git merge feature', 'git switch feature', 'git reset --hard']) {
      const out = run(fresh(), line).result.output
      refusal(out)
      expect(out).not.toMatch(/^(fatal|error|usage|hint):/)
    }
  })
})

// Тайники и `git checkout -- <файл>` работают (appendixStash.test.ts, appendixRestore.test.ts); здесь —
// что диспетчер их передаёт обработчикам и что формы вне области остаются отказом области.
describe('тайники и checkout -- файл в диспетчере', () => {
  it('git stash во всех формах области отвечает выводом git с кодом возврата, а не отказом области', () => {
    const s = fresh()
    const edited = { ...s, working: { ...s.working, 'app.js': 'q\n' } }
    for (const form of ['git stash', 'git stash -m "msg"', 'git stash push -m msg', 'git stash save msg', 'git stash list', 'git stash apply', 'git stash pop', 'git stash drop', 'git stash clear']) {
      const r = run(edited, form)
      expect(r.result.exitCode, form).toBeDefined()
      expect(r.result.output.startsWith('[тренажёр]'), form).toBe(false)
    }
  })

  it('git stash вне области (show, -u, branch, --index) — отказ области, состояние репозитория не меняется', () => {
    const s = fresh()
    const edited = { ...s, working: { ...s.working, 'app.js': 'q\n' } }
    for (const form of ['git stash show', 'git stash -u', 'git stash branch x', 'git stash pop --index']) {
      const r = run(edited, form)
      expect(r.result.output, form).toBe(ru.appendix.errors.form('stash', form.replace('git stash ', ''), ru.appendix.allowed.stash))
      expect(r.result.exitCode).toBeUndefined()
      expect(r.state.working, form).toEqual(edited.working)
      expect(r.state.commits).toEqual(edited.commits)
      expect(r.state.stashes).toEqual([])
    }
  })

  it('git checkout -- app.js возвращает файл из индекса, а не отвечает отказом области', () => {
    const s = fresh()
    const edited = { ...s, working: { ...s.working, 'app.js': 'q\n' } }
    const r = run(edited, 'git checkout -- app.js')
    expect(r.result).toMatchObject({ output: '', exitCode: 0 })
    expect(r.state.working['app.js']).toBe(s.working['app.js'])
  })
})

describe('диспетчер не бросает исключений', () => {
  it('странный ввод превращается в результат', () => {
    const inputs = [
      'git ""',
      'git tag ""',
      "git tag '' ''",
      'git log --',
      'git show --',
      'git branch --',
      'git checkout --',
      'git add --',
      'git status --',
      'git commit --',
      'git diff --',
      'git tag --',
      'git tag -',
      'git log -',
      'git add -',
      'git commit -m "' + 'я'.repeat(1000) + '"',
      'git tag ' + 'x'.repeat(5000),
      'git log \u0000',
      'git tag \u{1F600}',
      'git tag -l "\u{1F600}*"',
      'git ' + '-'.repeat(50),
      'GIT tag v1',
      'git TAG v1',
      'git tag v1 HEAD~99999999999999999999',
      'git show HEAD^9999999999',
    ]
    for (const line of inputs) {
      expect(() => run(fresh(), line), JSON.stringify(line)).not.toThrow()
    }
  })

  it('обработчики не меняют входное состояние (оно заморожено рекурсивно)', () => {
    const deepFreeze = <T>(value: T): T => {
      if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value)
        for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key])
      }
      return value
    }
    let state = deepFreeze(fresh())
    const commands = [
      'git status', 'git tag v1', 'git tag -a v2 -m "Релиз"', 'git tag -f v1 HEAD~1', 'git tag -l', 'git tag -d v1', 'git show v2', 'git log --oneline --all',
      'git branch topic', 'git checkout topic', 'git checkout -b other', 'git add .', 'git add app.js', 'git diff', 'git diff --staged',
    ]
    for (const command of commands) state = deepFreeze(run(state, command).state)
    state = deepFreeze(createFile(state, 'x.txt'))
    state = deepFreeze(run(state, 'git add -A').state)
    state = deepFreeze(run(state, 'git commit -m "Файл"').state)
    expect(Object.keys(state.commits)).toHaveLength(5)
  })
})
