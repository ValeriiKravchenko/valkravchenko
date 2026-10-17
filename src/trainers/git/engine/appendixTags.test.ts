// git tag (target.md, часть X, места 1–4). Вывод git — дословно из section8-git-runs.txt (П8.2) и
// appendix-g18e-git-runs.txt (П8.29, П8.30); строки протокола названы в заголовках тестов.
import { describe, expect, it } from 'vitest'
import { commitOf, currentCommitId } from './appendixRepo'
import { fresh, protocolEntry, run, runAll, where } from './appendixProtocolKit'
import type { AppendixState } from './appendixSection'
import { ru } from '../locales/ru'

const ax = ru.appendix.explain
const seed = ru.appendix.seed
const idOf = (state: AppendixState, message: string) => Object.values(state.commits).find((c) => c.message === message)!.id
const refusal = (output: string) => expect(output.startsWith('[тренажёр]')).toBe(true)
const tagOf = (state: AppendixState, name: string) => state.tags[name]

describe('создание лёгкого тега', () => {
  it(`git tag <имя>: тег на коммите HEAD, вывод пуст, код 0 (${where('П8.2', 'git tag v1.0.0')})`, () => {
    const s = fresh()
    const r = run(s, 'git tag v1.0.0')
    expect(r.result).toMatchObject({ output: '', exitCode: 0, ok: true })
    expect(tagOf(r.state, 'v1.0.0')).toEqual({ kind: 'light', commit: currentCommitId(s) })
    expect(r.result.explanation).toBe(ax.tagLight('v1.0.0'))
  })

  it('тег не двигает ветки, HEAD, журнал и часы', () => {
    const s = fresh()
    const after = run(s, 'git tag v1.0.0').state
    expect(after.branches).toEqual(s.branches)
    expect(after.head).toEqual(s.head)
    expect(after.reflog).toEqual(s.reflog)
    expect(after.commits).toEqual(s.commits)
    expect(after.clock).toBe(s.clock)
  })

  it(`git tag <имя> <ссылка>: HEAD~1, ветка, лёгкий тег, начало id (${where('П8.29', 'git tag v7 HEAD~1')}, ${where('П8.29', 'git tag v8 691d063')})`, () => {
    const s = runAll(fresh(), ['git tag v6 feature'])
    const base = idOf(s, seed.baseMessage)
    expect(tagOf(run(s, 'git tag a HEAD~1').state, 'a')).toEqual({ kind: 'light', commit: base })
    expect(tagOf(run(s, 'git tag a feature~2').state, 'a')).toEqual({ kind: 'light', commit: base })
    expect(tagOf(run(s, 'git tag a v6').state, 'a')).toEqual({ kind: 'light', commit: s.branches.feature })
    expect(tagOf(run(s, `git tag a ${base.slice(0, 7)}`).state, 'a')).toEqual({ kind: 'light', commit: base })
    expect(tagOf(run(s, `git tag a ${base.slice(0, 4)}`).state, 'a')).toEqual({ kind: 'light', commit: base })
  })

  it('имя на кириллице допустимо (П8.29: Релиз)', () => {
    expect(tagOf(run(fresh(), 'git tag Релиз').state, 'Релиз').kind).toBe('light')
  })

  it(`уже есть: fatal: tag … already exists, код 128, тег не перезаписан, совет в речи (${where('П8.2', 'git tag v1.0.0', 1)})`, () => {
    const s = runAll(fresh(), ['git tag v1.0.0'])
    const r = run(s, 'git tag v1.0.0 HEAD~1')
    expect(r.result.output).toBe("fatal: tag 'v1.0.0' already exists")
    expect(r.result.exitCode).toBe(128)
    expect(r.result.explanation).toBe(ax.tagExists)
    expect(r.state.tags).toEqual(s.tags)
    expect(protocolEntry('П8.2', 'git tag v1.0.0', 1).output).toBe(r.result.output)
  })
})

describe('создание аннотированного тега', () => {
  const forms: [string, string][] = [
    ['git tag -a v1.1.0 -m "Релиз"', 'Релиз'],
    ['git tag -am "Кандидат" v1.1.0', 'Кандидат'],
    ['git tag -m "Только сообщение" v1.1.0', 'Только сообщение'],
    ['git tag --annotate v1.1.0 --message "Длинные флаги"', 'Длинные флаги'],
    ['git tag --message=Равно v1.1.0', 'Равно'],
    ['git tag -mfoo v1.1.0', 'foo'],
    ['git tag -amfoo v1.1.0', 'foo'],
    ['git tag v1.1.0 -a -m "порядок"', 'порядок'],
    ['git tag -m "m" -a v1.1.0 feature~1', 'm'],
  ]
  for (const [command, message] of forms) {
    it(`${command}: аннотированный тег с сообщением «${message}», вывод пуст, код 0`, () => {
      const s = fresh()
      const r = run(s, command)
      expect(r.result).toMatchObject({ output: '', exitCode: 0, ok: true })
      const tag = tagOf(r.state, 'v1.1.0')
      expect(tag.kind).toBe('annotated')
      if (tag.kind === 'annotated') {
        expect(tag.message).toBe(message)
        expect(tag.object).toMatch(/^[0-9a-f]{40}$/)
        expect(tag.object).not.toBe(tag.commit)
      }
      expect(r.state.clock).toBe(s.clock + 1)
      expect(r.result.explanation).toContain('Аннотированный тег «v1.1.0»')
    })
  }

  it('протокол: те же команды дают код 0 и пустой вывод (П8.2)', () => {
    for (const command of ['git tag -a v1.1.0 -m "Релиз"', 'git tag -am "Кандидат" v1.2.0-rc', 'git tag -m "Только сообщение" v1.3.0', 'git tag --annotate v1.4.0 --message "Длинные флаги"']) {
      expect(protocolEntry('П8.2', command)).toMatchObject({ output: '', exitCode: 0 })
    }
  })

  it('тег на указанный коммит: git tag -a v2 -m "Релиз" feature', () => {
    const s = fresh()
    const tag = tagOf(run(s, 'git tag -a v2 -m "Релиз" feature').state, 'v2')
    expect(tag.commit).toBe(s.branches.feature)
  })

  it('сообщение: хвостовые пробелы срезаются, ведущие остаются (П8.29: git show показывает « лид»)', () => {
    const tag = tagOf(run(fresh(), 'git tag -m "  лид  " v3').state, 'v3')
    expect(tag.kind === 'annotated' && tag.message).toBe('  лид')
  })

  it('id объекта зависит от имени, сообщения, коммита и логического момента', () => {
    const base = fresh()
    const object = (s: AppendixState, name: string) => {
      const t = tagOf(s, name)
      return t.kind === 'annotated' ? t.object : ''
    }
    const a = run(base, 'git tag -a v1 -m "Релиз"').state
    expect(object(run(base, 'git tag -a v1 -m "Релиз"').state, 'v1')).toBe(object(a, 'v1'))
    expect(object(run(base, 'git tag -a v2 -m "Релиз"').state, 'v2')).not.toBe(object(a, 'v1'))
    expect(object(run(base, 'git tag -a v1 -m "Другое"').state, 'v1')).not.toBe(object(a, 'v1'))
    expect(object(run(base, 'git tag -a v1 -m "Релиз" feature').state, 'v1')).not.toBe(object(a, 'v1'))
    // Тот же тег, удалённый и созданный заново в другой момент, получает другой id.
    const again = runAll(a, ['git tag -d v1', 'git tag -a v1 -m "Релиз"'])
    expect(object(again, 'v1')).not.toBe(object(a, 'v1'))
  })

  it(`-a без -m: git открыл бы редактор — отказ области, тег не создан (${where('П8.2', 'GIT_EDITOR=true git tag -a v1.5.0')} — вывод зависит от редактора)`, () => {
    const s = fresh()
    const r = run(s, 'git tag -a v1.5.0')
    refusal(r.result.output)
    expect(r.result.output).toContain('git tag -a v1.5.0 -m "текст"')
    expect(r.result.exitCode).toBeUndefined()
    expect(r.state.tags).toEqual({})
    expect(r.state.clock).toBe(s.clock)
  })

  it('пустое сообщение, сообщение из пробелов и из нескольких строк — отказ области', () => {
    for (const command of ['git tag -a v1 -m ""', 'git tag -a v1 -m "   "', 'git tag -a v1 -m "a\nb"']) {
      const r = run(fresh(), command)
      refusal(r.result.output)
      expect(r.state.tags, command).toEqual({})
    }
  })
})

describe('ошибки создания', () => {
  const failures: [string, string, string, number][] = [
    ['П8.2', 'git tag "a b"', "fatal: 'a b' is not a valid tag name.", 128],
    ['П8.2', 'git tag v1..2', "fatal: 'v1..2' is not a valid tag name.", 128],
    ['П8.2', 'git tag x~1', "fatal: 'x~1' is not a valid tag name.", 128],
    ['П8.2', 'git tag v1.lock', "fatal: 'v1.lock' is not a valid tag name.", 128],
    ['П8.2', 'git tag -- -x', "fatal: '-x' is not a valid tag name.", 128],
    ['П8.29', 'git tag HEAD', "fatal: 'HEAD' is not a valid tag name.", 128],
    ['П8.29', 'git tag ""', "fatal: '' is not a valid tag name.", 128],
    ['П8.2', 'git tag v9 nosuch', "fatal: Failed to resolve 'nosuch' as a valid ref.", 128],
    ['П8.2', 'git tag a b c', 'fatal: too many arguments', 128],
    ['П8.2', 'git tag -m', "error: switch `m' requires a value", 129],
  ]
  for (const [block, command, output, code] of failures) {
    it(`${command} → ${output.split('\n')[0]}, код ${code} (${where(block, command)})`, () => {
      const s = fresh()
      const r = run(s, command)
      expect(r.result.output).toBe(output)
      expect(r.result.exitCode).toBe(code)
      expect(r.state.tags).toEqual({})
      expect(protocolEntry(block, command)).toMatchObject({ output, exitCode: code })
    })
  }

  it('«not a valid tag name» сопровождается объяснением в речи, а не в выводе git', () => {
    const r = run(fresh(), 'git tag "a b"').result
    expect(r.explanation).toBe(ax.tagInvalidName)
    expect(r.output).toBe("fatal: 'a b' is not a valid tag name.")
  })

  it(`порядок проверок: сначала ссылка, потом имя, потом «уже есть» (${where('П8.29', 'git tag "a b" nosuch')}, ${where('П8.29', 'git tag v5 nosuch')})`, () => {
    const s = runAll(fresh(), ['git tag v5'])
    expect(run(s, 'git tag "a b" nosuch').result.output).toBe(protocolEntry('П8.29', 'git tag "a b" nosuch').output)
    expect(run(s, 'git tag v5 nosuch').result.output).toBe(protocolEntry('П8.29', 'git tag v5 nosuch').output)
    expect(run(s, 'git tag a b c d').result.output).toBe('fatal: too many arguments')
  })

  it(`«уже есть» раньше редактора: git tag -a v5 при существующем v5 (${where('П8.29', 'GIT_EDITOR=true git tag -a v5')})`, () => {
    const s = runAll(fresh(), ['git tag v5'])
    const r = run(s, 'git tag -a v5')
    expect(r.result.output).toBe(protocolEntry('П8.29', 'GIT_EDITOR=true git tag -a v5').output)
    expect(r.result.exitCode).toBe(128)
  })

  it(`неизвестный ключ: error: unknown switch и полный usage, код 129 (${where('П8.2', 'git tag -z')})`, () => {
    const r = run(fresh(), 'git tag -z').result
    expect(r.output).toBe(protocolEntry('П8.2', 'git tag -z').output)
    expect(r.exitCode).toBe(129)
    expect(r.explanation).toBeNull()
    expect(r.output).toContain('usage: git tag [-a | -s | -u <key-id>] [-f] [-m <msg> | -F <file>] [-e]')
    expect(r.output.split('\n')[0]).toBe("error: unknown switch `z'")
  })

  it(`неизвестный длинный ключ: error: unknown option, код 129 (${where('П8.2', 'git tag --nosuch')})`, () => {
    const r = run(fresh(), 'git tag --nosuch').result
    expect(r.output).toBe(protocolEntry('П8.2', 'git tag --nosuch').output)
    expect(r.exitCode).toBe(129)
    expect(r.output.split('\n')[0]).toBe("error: unknown option `nosuch'")
  })

  it(`ключ в кластере: git tag -az называет первую неизвестную букву (${where('П8.29', 'git tag -az')})`, () => {
    const r = run(fresh(), 'git tag -az').result
    expect(r.output.split('\n')[0]).toBe("error: unknown switch `z'")
    expect(r.output).toBe(protocolEntry('П8.29', 'git tag -az').output)
    expect(r.exitCode).toBe(129)
  })
})

describe('отказ области вместо выдуманного ответа', () => {
  it('ключи из usage, которые раздел не разбирает: -n, -s, -u, -v, -F, -e, -i, --contains, --sort, --sign, --help и сокращения', () => {
    const forms = ['git tag -n', 'git tag -s v1', 'git tag -u key v1', 'git tag -v v1', 'git tag -F f v1', 'git tag -e v1', 'git tag -i', 'git tag --contains HEAD', 'git tag --sort=x', 'git tag --sign v1', 'git tag --help', 'git tag --mess x v1', 'git tag --list=x', 'git tag -h']
    for (const form of forms) {
      const r = run(fresh(), form)
      expect(r.result.exitCode, form).toBeUndefined()
      refusal(r.result.output)
      expect(r.state.tags, form).toEqual({})
    }
  })

  it('ключи создания без имени (git prints usage): -a, -f, -m "x" — отказ области', () => {
    for (const form of ['git tag -a', 'git tag -f', 'git tag -m x']) refusal(run(fresh(), form).result.output)
  })

  it('смесь режимов: -l с -a, -d с -f, -l с -d, два -m — отказ области (git ответил бы usage или ошибкой сочетания)', () => {
    for (const form of ['git tag -l -a', 'git tag -d -f v1', 'git tag -l -d', 'git tag -m a -m b v1', 'git tag -d -m x v1']) refusal(run(fresh(), form).result.output)
  })

  it('имя с «/» или «@» и имя, совпадающее с веткой, — отказ области', () => {
    for (const form of ['git tag release/1', 'git tag @', 'git tag master', 'git tag feature']) {
      const r = run(fresh(), form)
      refusal(r.result.output)
      expect(r.state.tags, form).toEqual({})
    }
  })

  it('тег на аннотированный тег (вложенный тег) — отказ области; на лёгкий — обычный тег', () => {
    const s = runAll(fresh(), ['git tag -a v2 -m "m"', 'git tag v1'])
    refusal(run(s, 'git tag v3 v2').result.output)
    expect(tagOf(run(s, 'git tag v3 v1').state, 'v3')).toEqual({ kind: 'light', commit: currentCommitId(s) })
    // v2~0 — уже коммит, а не тег.
    expect(tagOf(run(s, 'git tag v3 v2~0').state, 'v3').kind).toBe('light')
  })

  it('ссылка, которую модель не разбирает, — отказ области', () => {
    refusal(run(fresh(), 'git tag v1 HEAD@{1}').result.output)
  })

  it('тот же тег дважды в -d — отказ области (git ответил особой ошибкой ссылок)', () => {
    const s = runAll(fresh(), ['git tag v9'])
    const r = run(s, 'git tag -d v9 v9')
    refusal(r.result.output)
    expect(r.state.tags).toEqual(s.tags)
    expect(protocolEntry('П8.30', 'git tag -d v9 v9').output).toContain('multiple updates for ref')
  })

  it('«/» в имени — причина отказа в протоколе: rel и rel/1 конфликтуют (П8.29)', () => {
    expect(protocolEntry('П8.29', 'git tag rel').output).toContain("cannot lock ref 'refs/tags/rel'")
  })
})

describe('git tag -f (место 2)', () => {
  it(`лёгкий тег уже на этом коммите: молчит, состояние то же (${where('П8.30', 'git tag -f v1')})`, () => {
    const s = runAll(fresh(), ['git tag v1'])
    const r = run(s, 'git tag -f v1')
    expect(r.result).toMatchObject({ output: '', exitCode: 0 })
    expect(r.state.tags).toEqual(s.tags)
    expect(r.result.explanation).toBe(ax.tagForcedSame('v1'))
  })

  it(`тега нет: -f создаёт молча (${where('П8.30', 'git tag -f v7')})`, () => {
    const r = run(fresh(), 'git tag -f v7')
    expect(r.result).toMatchObject({ output: '', exitCode: 0 })
    expect(tagOf(r.state, 'v7').kind).toBe('light')
    expect(r.result.explanation).toBe(ax.tagLight('v7'))
  })

  it(`тег переехал: Updated tag … (was <id7 коммита>) (${where('П8.30', 'git tag -f v1 HEAD~1')})`, () => {
    const s = runAll(fresh(), ['git tag v1'])
    const r = run(s, 'git tag -f v1 HEAD~1')
    expect(r.result.output).toBe(`Updated tag 'v1' (was ${currentCommitId(s).slice(0, 7)})`)
    expect(r.result.exitCode).toBe(0)
    expect(tagOf(r.state, 'v1')).toEqual({ kind: 'light', commit: idOf(s, seed.baseMessage) })
    expect(r.result.explanation).toBe(ax.tagUpdated('v1'))
  })

  it(`у аннотированного was — id объекта тега, а не коммита; -f без -a делает тег лёгким (${where('П8.30', 'git tag -f v2')}, section8-git-runs.txt П8.2: Updated tag 'v1.1.0' (was 35d3821))`, () => {
    const s = runAll(fresh(), ['git tag -a v2 -m "Релиз"'])
    const old = tagOf(s, 'v2')
    const r = run(s, 'git tag -f v2')
    expect(old.kind === 'annotated' && r.result.output).toBe(`Updated tag 'v2' (was ${(old.kind === 'annotated' ? old.object : '').slice(0, 7)})`)
    expect(old.kind === 'annotated' && old.object.slice(0, 7)).not.toBe(currentCommitId(s).slice(0, 7))
    expect(tagOf(r.state, 'v2')).toEqual({ kind: 'light', commit: currentCommitId(s) })
    expect(r.result.explanation).toContain(ax.tagUpdated('v2'))
  })

  it(`аннотированный поверх аннотированного на том же коммите: объект новый, Updated печатается (${where('П8.30', 'git tag -f -a v8 -m "y"')})`, () => {
    const s = runAll(fresh(), ['git tag -f -a v8 -m "x"'])
    const old = tagOf(s, 'v8')
    const r = run(s, 'git tag -f -a v8 -m "y"')
    expect(old.kind === 'annotated' && r.result.output).toBe(`Updated tag 'v8' (was ${(old.kind === 'annotated' ? old.object : '').slice(0, 7)})`)
    const tag = tagOf(r.state, 'v8')
    expect(tag.kind === 'annotated' && tag.message).toBe('y')
    expect(r.result.explanation).toContain(ax.tagAnnotated('v8'))
  })

  it('-f не отменяет проверку ссылки и имени', () => {
    expect(run(fresh(), 'git tag -f v1 nosuch').result.output).toBe("fatal: Failed to resolve 'nosuch' as a valid ref.")
    expect(run(fresh(), 'git tag -f "a b"').result.output).toBe("fatal: 'a b' is not a valid tag name.")
  })
})

describe('git tag -d', () => {
  it(`удаляет метку: Deleted tag … (was <id7>), коммит остаётся (${where('П8.2', 'git tag -d v1.0.0')})`, () => {
    const s = runAll(fresh(), ['git tag v1.0.0 HEAD~1'])
    const r = run(s, 'git tag -d v1.0.0')
    expect(r.result.output).toBe(`Deleted tag 'v1.0.0' (was ${idOf(s, seed.baseMessage).slice(0, 7)})`)
    expect(r.result.exitCode).toBe(0)
    expect(r.state.tags).toEqual({})
    expect(r.state.commits).toEqual(s.commits)
    expect(r.result.explanation).toBe(ax.tagDeleted)
  })

  it(`у аннотированного was — id объекта (${where('П8.2', 'git tag -d v1.2.0-rc v1.3.0')})`, () => {
    const s = runAll(fresh(), ['git tag -am "Кандидат" v1.2.0-rc', 'git tag v1.3.0'])
    const rc = tagOf(s, 'v1.2.0-rc')
    const r = run(s, 'git tag -d v1.2.0-rc v1.3.0')
    expect(r.result.output).toBe(`Deleted tag 'v1.2.0-rc' (was ${(rc.kind === 'annotated' ? rc.object : '').slice(0, 7)})\nDeleted tag 'v1.3.0' (was ${currentCommitId(s).slice(0, 7)})`)
    expect(r.result.exitCode).toBe(0)
  })

  it(`нет такого тега: error: tag … not found., код 1 (${where('П8.2', 'git tag -d v1.0.0', 1)})`, () => {
    const r = run(fresh(), 'git tag -d v1.0.0')
    expect(r.result.output).toBe("error: tag 'v1.0.0' not found.")
    expect(r.result.exitCode).toBe(1)
    expect(r.result.explanation).toBe(ax.tagNotFound)
  })

  it(`несколько имён: сначала все ошибки, потом Deleted по порядку слов, код 1, найденные удалены (${where('П8.30', 'git tag -d v1 nosuch v8')})`, () => {
    const s = runAll(fresh(), ['git tag v1', 'git tag v8', 'git tag keep'])
    const r = run(s, 'git tag -d v1 nosuch v8')
    expect(r.result.output).toBe(`error: tag 'nosuch' not found.\nDeleted tag 'v1' (was ${currentCommitId(s).slice(0, 7)})\nDeleted tag 'v8' (was ${currentCommitId(s).slice(0, 7)})`)
    expect(r.result.exitCode).toBe(1)
    expect(Object.keys(r.state.tags)).toEqual(['keep'])
    expect(protocolEntry('П8.30', 'git tag -d v1 nosuch v8').output.split('\n')[0]).toBe("error: tag 'nosuch' not found.")
  })

  it(`ошибка и в начале списка (${where('П8.2', 'git tag -d nosuch v1.4.0')})`, () => {
    const s = runAll(fresh(), ['git tag v1.4.0'])
    const r = run(s, 'git tag -d nosuch v1.4.0')
    expect(r.result.output.split('\n')).toEqual(["error: tag 'nosuch' not found.", `Deleted tag 'v1.4.0' (was ${currentCommitId(s).slice(0, 7)})`])
    expect(r.result.exitCode).toBe(1)
  })

  it(`без имени: пустой вывод, код 0, ничего не удалено (${where('П8.2', 'git tag -d')})`, () => {
    const s = runAll(fresh(), ['git tag v1'])
    const r = run(s, 'git tag -d')
    expect(r.result).toMatchObject({ output: '', exitCode: 0, ok: true })
    expect(r.state.tags).toEqual(s.tags)
    expect(r.result.explanation).toBe(ax.tagDeleteNoNames)
  })

  it('--delete и имя после ключа: git tag v1 --delete', () => {
    const s = runAll(fresh(), ['git tag v1'])
    expect(run(s, 'git tag --delete v1').state.tags).toEqual({})
    expect(run(s, 'git tag v1 -d').state.tags).toEqual({})
  })
})

describe('список тегов', () => {
  const s = runAll(fresh(), ['git tag v1.0.0', 'git tag -a v1.1.0 -m "Релиз"', 'git tag -am "Кандидат" v1.2.0-rc', 'git tag v1.3.0', 'git tag v1.4.0', 'git tag Релиз', 'git tag V0'])

  it(`пока тегов нет: пустой вывод, код 0 (${where('П8.2', 'git tag')})`, () => {
    const r = run(fresh(), 'git tag')
    expect(r.result).toMatchObject({ output: '', exitCode: 0, ok: true })
    expect(r.result.explanation).toBe(ax.tagNone)
  })

  it(`git tag, -l, --list: по байтам имени (${where('П8.2', 'git tag', 1)})`, () => {
    const expected = 'V0\nv1.0.0\nv1.1.0\nv1.2.0-rc\nv1.3.0\nv1.4.0\nРелиз'
    for (const form of ['git tag', 'git tag -l', 'git tag --list']) {
      const r = run(s, form).result
      expect(r.output, form).toBe(expected)
      expect(r.exitCode).toBe(0)
      expect(r.explanation).toBe(ax.tagListed)
    }
  })

  it(`маски (${where('П8.2', 'git tag -l "v1.*"')}, ${where('П8.2', 'git tag -l v1.1*')}, ${where('П8.2', 'git tag -l nosuch*')})`, () => {
    expect(run(s, 'git tag -l "v1.*"').result.output).toBe('v1.0.0\nv1.1.0\nv1.2.0-rc\nv1.3.0\nv1.4.0')
    expect(run(s, 'git tag -l v1.1*').result.output).toBe('v1.1.0')
    const none = run(s, 'git tag -l nosuch*').result
    expect(none).toMatchObject({ output: '', exitCode: 0 })
    expect(none.explanation).toBe(ax.tagNoMatch)
  })

  it(`несколько масок, ?, класс [1-5] и точное имя (${where('П8.30', 'git tag -l "v[1-5]"')}, ${where('П8.30', 'git tag -l "v?" "x*"')})`, () => {
    const t = runAll(fresh(), ['git tag v1', 'git tag v2', 'git tag v7', 'git tag v10'])
    expect(run(t, 'git tag -l "v[1-5]"').result.output).toBe('v1\nv2')
    expect(run(t, 'git tag -l "v?" "x*"').result.output).toBe('v1\nv2\nv7')
    expect(run(t, 'git tag --list "v?"').result.output).toBe('v1\nv2\nv7')
    expect(run(t, 'git tag -l v1').result.output).toBe('v1')
    expect(run(t, 'git tag -l "v[!1]"').result.output).toBe('v2\nv7')
  })

  it('маска с обратной косой или классом [:alpha:] — отказ области', () => {
    refusal(run(s, 'git tag -l "a\\*"').result.output)
    refusal(run(s, 'git tag -l "[[:alpha:]]"').result.output)
  })

  it('список не меняет состояние тегов', () => {
    expect(run(s, 'git tag -l "v*"').state.tags).toEqual(s.tags)
  })
})

describe('миссия 1 ставится только успешным созданием лёгкого тега', () => {
  it('git tag <имя> и git tag <имя> <ссылка> засчитывают; аннотированный не засчитывает', () => {
    expect(run(fresh(), 'git tag v1').state.missionsDone.lightTag).toBe(true)
    expect(run(fresh(), 'git tag v1 HEAD~1').state.missionsDone.lightTag).toBe(true)
    expect(run(fresh(), 'git tag -a v1 -m "m"').state.missionsDone.lightTag).toBe(false)
    expect(run(fresh(), 'git tag -m "m" v1').state.missionsDone.lightTag).toBe(false)
  })

  it('ошибки, список и удаление миссию не засчитывают', () => {
    for (const form of ['git tag', 'git tag "a b"', 'git tag v9 nosuch', 'git tag -d v1', 'git tag -l']) expect(run(fresh(), form).state.missionsDone.lightTag, form).toBe(false)
  })

  it('-f: переставил — засчитано; тот же коммит — нет; создал новый — засчитано; лёгкий поверх аннотированного — засчитано', () => {
    const annotated = runAll(fresh(), ['git tag -a v1 -m "m"'])
    expect(run(annotated, 'git tag -f v1').state.missionsDone.lightTag).toBe(true)
    expect(run(fresh(), 'git tag -f v7').state.missionsDone.lightTag).toBe(true)
    const light = runAll(fresh(), ['git tag v1'])
    const reset = { ...light, missionsDone: { ...light.missionsDone, lightTag: false } }
    expect(run(reset, 'git tag -f v1').state.missionsDone.lightTag).toBe(false)
    expect(run(reset, 'git tag -f v1 HEAD~1').state.missionsDone.lightTag).toBe(true)
  })

  it('git tag -d миссию не снимает', () => {
    const s = runAll(fresh(), ['git tag v1', 'git tag -d v1'])
    expect(s.tags).toEqual({})
    expect(s.missionsDone.lightTag).toBe(true)
  })
})

describe('теги и история терминала', () => {
  it('tag не меняет файлы и коммиты; в историю попадает команда', () => {
    const s = fresh()
    const r = run(s, 'git tag v1')
    expect(r.state.working).toEqual(s.working)
    expect(r.state.index).toEqual(s.index)
    expect(commitOf(r.state, currentCommitId(r.state))).toEqual(commitOf(s, currentCommitId(s)))
    expect(r.state.history).toHaveLength(1)
    expect(r.state.history[0]).toMatchObject({ kind: 'command', input: 'git tag v1', ok: true })
  })
})
