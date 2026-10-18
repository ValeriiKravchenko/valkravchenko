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
      a.errors.switchRefForm('HEAD'),
      a.errors.branchDeleteDuplicate,
      a.errors.detachedCommandOutOfScope('merge'),
      a.errors.detachedCommandOutOfScope('pull'),
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

  it('речь отсоединённого HEAD и журнала не начинается с метки и не выглядит как вывод git (target.md, часть XII, «Речь»)', () => {
    const e = a.explain
    const texts = [
      e.detachedEntered,
      e.previousPosition,
      e.leavingBehind(1, 'abc1234'),
      e.leavingBehind(2, 'abc1234'),
      e.leavingBehind(5, 'abc1234'),
      e.detachedBranchCreated('rescue'),
      e.carriedFiles,
      e.switchBranchExpected,
      e.checkoutRefusedEdit,
      e.checkoutHeadStays,
      e.reflogShortEntries,
      e.reflogShown,
      e.commitDetached,
      e.statusDetachedAt,
      e.statusDetachedFrom,
      e.statusRefsHeads,
      e.statusNameLost,
      e.branchListDetached,
      e.logDetached,
      e.stashNoBranch,
      e.branchNotFound,
      e.branchNotMerged(false),
      e.branchNotMerged(true),
      e.branchDeleted,
      e.branchDeletedUnderHead,
    ]
    for (const text of texts) {
      expect(text.startsWith('[тренажёр]')).toBe(false)
      expect(text).not.toMatch(/^(fatal|error|usage|hint|warning):/)
    }
  })

  it('смысл речи по таблице части XII: HEAD — указатель, Previous HEAD position не ошибка, три пути спасения, номера HEAD@{n} сдвигаются, switch только на ветки', () => {
    const e = a.explain
    expect(e.detachedEntered).toContain('указывает прямо на коммит, а не на ветку')
    expect(e.detachedEntered).toContain('никуда не сдвинулись')
    expect(e.previousPosition).toContain('не ошибка')
    const paths = e.leavingBehind(2, 'abc1234')
    for (const piece of ['git switch -c', 'git branch имя abc1234', 'git reflog', 'HEAD@{1}', 'сдвигаются']) expect(paths).toContain(piece)
    expect(e.reflogShown).toContain('n перемещений назад, а не n коммитов назад')
    expect(e.switchBranchExpected).toContain('только на ветки')
    expect(e.switchBranchExpected).toContain('--detach')
    expect(e.branchDeletedUnderHead).toContain('HEAD указывает на коммит, а не на ветку')
    expect(e.statusDetachedFrom).toContain('Названо то место, куда поставили')
    expect(e.stashNoBranch).toContain('(no branch)')
  })

  it('число коммитов склоняется: 1 коммит, 2 коммита, 5 коммитов, 11 коммитов, 21 коммит', () => {
    const word = (n: number) => a.explain.leavingBehind(n, 'x').match(/Брошено: \d+ (\S+)\./)?.[1]
    expect([1, 2, 5, 11, 21, 22, 25].map(word)).toEqual(['коммит', 'коммита', 'коммитов', 'коммитов', 'коммит', 'коммита', 'коммитов'])
  })

  it('списки команд в отказах называют switch и reflog, а допустимые формы — переходы и -d', () => {
    expect(a.errors.commandOutOfScope('rebase')).toContain('switch')
    expect(a.errors.commandOutOfScope('rebase')).toContain('reflog')
    expect(a.errors.gitUsageNoArgs).toContain('switch')
    expect(a.allowed.switch).toContain('--detach')
    expect(a.allowed.checkout).toContain('--detach')
    expect(a.allowed.branch).toContain('-d')
    expect(a.errors.revisionForm('log', 'x')).toContain('HEAD@{n}')
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
