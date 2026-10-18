// Речь раздела 8 (ru.appendix): всё, что выглядит как ответ команды, начинается с метки тренажёра;
// вывода git в словаре нет.
import { describe, expect, it } from 'vitest'
import { ru } from '../locales/ru'

const a = ru.appendix

describe('ru.appendix', () => {
  it('отказы области начинаются с метки [тренажёр]', () => {
    const samples: string[] = [
      a.errors.gitUsageNoArgs,
      a.errors.commandOutOfScope('rebase'),
      a.errors.stashRefForm('x'),
      a.errors.stashMessageForm,
      a.errors.stashConflict('pop', ['app.js']),
      a.errors.stashUnverified('pop'),
      a.errors.form('stash', '-u', a.allowed.stash),
      a.errors.form('tag', '-n', a.allowed.tag),
      a.errors.form('checkout', '', a.allowed.checkout),
      a.errors.renameDetection('status'),
      a.errors.statusNestedPaths,
      a.errors.pathspecForm('add', 'src/x'),
      a.errors.revisionForm('log', 'HEAD@{1}'),
      a.errors.checkoutFromRevision('master -- app.js'),
      a.errors.checkoutDuplicate,
      a.errors.checkoutDetach('v1'),
      a.errors.commitNeedsMessage,
      a.errors.refNameForm('тега', 'a/b'),
      a.errors.branchNameIsTag('v1'),
      a.errors.tagNameIsBranch('master'),
      a.errors.tagNested('v2'),
      a.errors.tagNeedsMessage('v1'),
      a.errors.tagMessageForm,
      a.errors.tagPatternForm('a\\*'),
      a.errors.tagDeleteDuplicate,
      a.errors.logPathFilter('app.js'),
      a.errors.showPathFilter('app.js'),
    ]
    for (const text of samples) expect(text.startsWith('[тренажёр]'), text).toBe(true)
  })

  it('форма без аргументов не оставляет двойного пробела', () => {
    expect(a.errors.form('checkout', '', a.allowed.checkout)).not.toContain('checkout  ')
  })

  it('пояснения не начинаются с метки и не выглядят как вывод git', () => {
    const explain = [a.explain.commitEmptyMessage, a.explain.commitStatNotShown, a.explain.authorDateNotShown, a.explain.showAnnotated, a.explain.tagLight('v1'), a.explain.tagAnnotated('v1'), a.explain.tagUpdated('v1'), a.explain.tagForcedSame('v1'), a.explain.tagListed, a.explain.tagNone, a.explain.tagNoMatch, a.explain.tagDeleted, a.explain.tagNotFound, a.explain.tagDeleteNoNames, a.explain.tagInvalidName, a.explain.tagExists, a.explain.stashSaved, a.explain.stashNothing, a.explain.stashListed, a.explain.stashListOtherBranch, a.explain.stashListEmpty, a.explain.stashApplied, a.explain.stashPopped, a.explain.stashIndexLost, a.explain.stashOtherBranch('master', 'feature'), a.explain.stashRefusedEdit, a.explain.stashRefusedUntracked, a.explain.stashDropped, a.explain.stashCleared, a.explain.stashNoEntries, a.explain.stashBadRef, a.explain.stashNotStashLike, a.explain.stashSubcommand, a.explain.restoreDone, a.explain.restoreNothing, a.explain.restorePathspec, a.explain.restoreWithoutDashes]
    for (const text of explain) {
      expect(text.startsWith('[тренажёр]')).toBe(false)
      expect(text).not.toMatch(/^(fatal|error|usage|hint|warning):/)
    }
  })

  it('речь исходной версии, которая учила неправде, убрана (target.md, место 2 и место 20)', () => {
    const all = JSON.stringify(a)
    expect(all).not.toContain('тем, кто уже скачал старый тег')
    expect(all).not.toContain('У тегов нет автора и даты')
    expect(all).not.toContain('тайников нет')
  })

  it('текст ✎ берётся из общего словаря: суффикс «+ правка» (решение В3)', () => {
    expect(ru.fileOps.editedSuffix).toBe(' + правка')
  })

  it('миссии 1 и 2 — формулировки исходной версии тренажёра', () => {
    expect(a.missions.lightTag.text).toBe('Отметь текущий коммит версией — поставь лёгкий тег.')
    expect(a.missions.annotatedShow.text).toBe('Поставь аннотированный тег с сообщением (например, на текущий коммит) и посмотри, что внутри.')
  })

  it('миссии 3 и 4 — тексты и подсказки из словаря (target.md, «Миссии»)', () => {
    expect(a.missions.stashSave.hint).toBe('измени файл (✎ изменить) → git stash')
    expect(a.missions.stashRestore.hint).toBe('git stash pop')
    expect(a.missions.stashSave.text).toContain('тайник')
    expect(a.missions.stashRestore.text).toContain('тайник')
  })

  it('речь о тайниках не говорит, что тайник «привязан» к ветке или что pop возвращает подготовку (места 11–12)', () => {
    const all = JSON.stringify(a.explain)
    expect(a.explain.stashIndexLost).toContain('неподготовленной')
    expect(a.explain.stashListOtherBranch).toContain('любой ветке')
    expect(all).not.toContain('рабочий каталог становится чистым')
  })

  it('рамка отличий называет автора и дату тега, подписи только на терминале и сводку коммита', () => {
    expect(a.note.items).toHaveLength(3)
    expect(a.note.items[0]).toContain('Tagger')
    expect(a.note.items[1]).toContain('терминал')
    expect(a.note.items[2]).toContain('сводку')
  })
})
