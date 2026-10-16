// Раздел 7, g18b2: миссии 1–4 (target.md, часть IX, «Миссии», строки 1780–1794; П7.19, section7-git-runs.txt:726–769).
import { describe, expect, it } from 'vitest'
import { fresh, protocolBlock, run, runAll } from './practicesProtocolKit'
import { DEFAULT_GITIGNORE, getPracticesMissions, writeGitignore, PRACTICES_MISSION_IDS } from './practicesSection'
import type { PracticesState } from './practicesSection'

/** Набор правил П7.19, собранный из блока протокола. */
const P719_RULES = '*.log\nnode_modules/\n.env*\n!.env.example\n!important.log\nbuild/*\n!build/output.map\n'

const done = (s: PracticesState) => getPracticesMissions(s).map((m) => m.done)

describe('исходное состояние и список', () => {
  it('четыре миссии в порядке target.md, ни одна не засчитана', () => {
    const missions = getPracticesMissions(fresh())
    expect(missions.map((m) => m.id)).toEqual([...PRACTICES_MISSION_IDS])
    expect(missions.map((m) => m.id)).toEqual(['envExample', 'importantLog', 'buildContents', 'aliasRun'])
    expect(missions.every((m) => !m.done && m.text !== '' && m.hint !== '')).toBe(true)
  })

  it('формулировки 1–3 говорят «не игнорируется», а не «отслеживается» (target.md:1776)', () => {
    for (const m of getPracticesMissions(fresh())) expect(m.text).not.toMatch(/отслежива|под контролем/)
  })
})

describe('миссии 1–3 по состоянию .gitignore', () => {
  it('П7.19: полный набор правил засчитывает все три (вердикты — строки 740–748 протокола)', () => {
    const lines = protocolBlock(19)[0].output.split('\n')
    // протокол: debug.log и logs/error.log совпали с *.log, important.log — с !-правилом (строка 5), .env — с .env*, .env.example — с !, bundle.js — с build/*, output.map — с !
    expect(lines).toContain('.gitignore:1:*.log\tdebug.log')
    expect(lines).toContain('.gitignore:5:!important.log\timportant.log')
    expect(lines).toContain('.gitignore:3:.env*\t.env')
    expect(lines).toContain('.gitignore:4:!.env.example\t.env.example')
    expect(lines).toContain('.gitignore:6:build/*\tbuild/bundle.js')
    expect(lines).toContain('.gitignore:7:!build/output.map\tbuild/output.map')
    expect(done(writeGitignore(fresh(), P719_RULES))).toEqual([true, true, true, false])
  })

  it('правила по умолчанию не засчитывают ничего', () => {
    expect(done(writeGitignore(fresh(), DEFAULT_GITIGNORE))).toEqual([false, false, false, false])
  })

  it('миссия 1: !.env.example после .env* (П7.19, строки 745–746)', () => {
    const s = writeGitignore(fresh(), '*.log\nnode_modules/\n.env*\n!.env.example\nbuild/\n')
    expect(done(s)).toEqual([true, false, false, false])
  })

  it('миссия 1 не засчитана, если .env тоже перестал игнорироваться', () => {
    expect(done(writeGitignore(fresh(), '*.log\nnode_modules/\nbuild/\n'))[0]).toBe(false)
  })

  it('миссия 2: *.log и !important.log (П7.6)', () => {
    expect(done(writeGitignore(fresh(), '*.log\n!important.log\n'))).toEqual([false, true, false, false])
  })

  it('миссия 2 не засчитана, если исключение стоит раньше правила (П7.7: побеждает последнее)', () => {
    expect(done(writeGitignore(fresh(), '!important.log\n*.log\n'))[1]).toBe(false)
  })

  it('миссия 2 не засчитана, если игнорируются не все .log', () => {
    expect(done(writeGitignore(fresh(), 'debug.log\n'))[1]).toBe(false)
  })

  it('миссия 3: build/* и !build/output.map (П7.9)', () => {
    expect(done(writeGitignore(fresh(), 'build/*\n!build/output.map\n'))).toEqual([false, false, true, false])
  })

  it('миссия 3 не засчитана при build/ + !build/output.map: каталог игнорируется целиком (П7.8)', () => {
    expect(done(writeGitignore(fresh(), 'build/\n!build/output.map\n'))[2]).toBe(false)
  })

  it('засчитанная миссия остаётся засчитанной после возврата правил', () => {
    let s = writeGitignore(fresh(), P719_RULES)
    s = writeGitignore(s, DEFAULT_GITIGNORE)
    s = writeGitignore(s, '')
    expect(done(s)).toEqual([true, true, true, false])
  })

  it('команда git для зачёта не нужна, но и после команд зачёт не пропадает', () => {
    let s = writeGitignore(fresh(), P719_RULES)
    s = runAll(s, ['git status --short --ignored', 'git check-ignore -v build/output.map'])
    expect(done(s).slice(0, 3)).toEqual([true, true, true])
  })

  it('зачёт не зависит от индекса: файл после git add -f остаётся «игнорируемым» по правилам', () => {
    const s = run(fresh(), 'git add -f important.log').state
    expect(done(writeGitignore(s, '*.log\n!important.log\n'))[1]).toBe(true)
  })
})

describe('миссия 4 по событию', () => {
  it('git config --global alias.st status без вызова не засчитывает', () => {
    expect(done(run(fresh(), 'git config --global alias.st status').state)[3]).toBe(false)
  })

  it('вызов алиаса засчитывает; повторный вызов состояние миссий не меняет', () => {
    const s1 = runAll(fresh(), ['git config --global alias.st status', 'git st'])
    expect(done(s1)[3]).toBe(true)
    expect(run(s1, 'git st').state.missionsDone).toEqual(s1.missionsDone)
  })

  it('алиас в .git/config тоже засчитывается', () => {
    expect(done(runAll(fresh(), ['git config alias.st status', 'git st']))[3]).toBe(true)
  })

  it('нулевой код, но не алиас (git status) не засчитывает', () => {
    expect(done(run(fresh(), 'git status').state)[3]).toBe(false)
  })

  it('сброс раздела: новая сессия без засчитанных миссий', () => {
    expect(done(fresh())).toEqual([false, false, false, false])
  })
})
