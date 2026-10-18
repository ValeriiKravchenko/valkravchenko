// Миссии шага A раздела 8 (target.md, часть X, «Миссии»): 1 — лёгкий тег, 2 — git show
// аннотированного тега, 3 — спрятать правку, 4 — вернуть спрятанное. По событию; засчитанная остаётся засчитанной (часть I, п. 2).
import { describe, expect, it } from 'vitest'
import { getAppendixMissions, markMission } from './appendixMissions'
import { APPENDIX_MISSION_IDS } from './appendixTypes'
import { fresh, run, runAll } from './appendixProtocolKit'
import { ru } from '../locales/ru'

describe('список миссий', () => {
  it('четыре миссии шага A в порядке target.md: тексты и подсказки из словаря, ни одна не выполнена', () => {
    expect(APPENDIX_MISSION_IDS).toEqual(['lightTag', 'annotatedShow', 'stashSave', 'stashRestore'])
    const views = getAppendixMissions(fresh())
    expect(views.map((v) => v.id)).toEqual(['lightTag', 'annotatedShow', 'stashSave', 'stashRestore'])
    expect(views.map((v) => v.done)).toEqual([false, false, false, false])
    expect(views[0]).toMatchObject({ text: ru.appendix.missions.lightTag.text, hint: 'git tag v1.0.0' })
    expect(views[1].hint).toBe('git tag -a v1.1.0 -m "Релиз" → git show v1.1.0')
  })

  it('markMission: засчитывает; повторный вызов возвращает то же состояние; другая миссия не затронута', () => {
    const s = fresh()
    const a = markMission(s, 'lightTag')
    expect(a.missionsDone).toEqual({ lightTag: true, annotatedShow: false, stashSave: false, stashRestore: false })
    expect(markMission(a, 'lightTag')).toBe(a)
    expect(markMission(a, 'annotatedShow').missionsDone).toEqual({ lightTag: true, annotatedShow: true, stashSave: false, stashRestore: false })
  })
})

describe('зачёт по событию', () => {
  it('миссия 1: git tag v1.0.0; миссия 2 ещё нет', () => {
    const s = run(fresh(), 'git tag v1.0.0').state
    expect(getAppendixMissions(s).map((v) => v.done)).toEqual([true, false, false, false])
  })

  it('миссия 2: аннотированный тег и git show по его имени', () => {
    const created = runAll(fresh(), ['git tag -a v1.1.0 -m "Релиз"'])
    expect(getAppendixMissions(created).map((v) => v.done)).toEqual([false, false, false, false])
    const shown = run(created, 'git show v1.1.0').state
    expect(getAppendixMissions(shown).map((v) => v.done)).toEqual([false, true, false, false])
  })

  it('git show лёгкого тега и git show HEAD миссию 2 не засчитывают', () => {
    const s = runAll(fresh(), ['git tag v1', 'git show v1', 'git show HEAD', 'git show'])
    expect(s.missionsDone.annotatedShow).toBe(false)
  })

  it('аннотированный тег без git show миссию 2 не засчитывает; git show до создания тега — тоже', () => {
    expect(runAll(fresh(), ['git tag -m "m" v2']).missionsDone.annotatedShow).toBe(false)
    expect(runAll(fresh(), ['git show v2', 'git tag -m "m" v2']).missionsDone.annotatedShow).toBe(false)
  })

  it('засчитанные миссии остаются после удаления тегов и новых коммитов', () => {
    const s = runAll(fresh(), ['git tag v1', 'git tag -a v2 -m "Релиз"', 'git show v2', 'git tag -d v1', 'git tag -d v2', 'git checkout feature'])
    expect(s.tags).toEqual({})
    expect(getAppendixMissions(s).map((v) => v.done)).toEqual([true, true, false, false])
  })

  it('миссии 1 и 2 за один путь: tag, tag -a, show, правка, коммит (S8-76 в части шага A)', () => {
    const s = fresh()
    const path = runAll({ ...s, working: { ...s.working, 'app.js': 'x\n' } }, ['git tag v1.0.0', 'git tag -a v1.1.0 -m "Релиз"', 'git show v1.1.0', 'git commit -am "Правка"'])
    expect(getAppendixMissions(path).map((v) => v.done)).toEqual([true, true, false, false])
  })

  it('отказ области и ошибки миссий не засчитывают', () => {
    const s = runAll(fresh(), ['git tag -a v1', 'git tag -s v1', 'git tag v1 nosuch', 'git tag "a b"', 'git stash'])
    expect(s.missionsDone).toEqual({ lightTag: false, annotatedShow: false, stashSave: false, stashRestore: false })
  })

  it('сброс раздела: новое состояние без выполненных миссий', () => {
    const done = runAll(fresh(), ['git tag v1'])
    expect(done.missionsDone.lightTag).toBe(true)
    expect(fresh().missionsDone.lightTag).toBe(false)
  })
})
