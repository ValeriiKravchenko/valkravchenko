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
      a.errors.stashConflictKind('pop', ['app.js']),
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
      a.errors.resetPathForm('app.js'),
      a.errors.cherryPickConflictKind(['app.js']),
      a.errors.cherryPickConflictKind(['app.js', 'about.html']),
      a.errors.cherryPickConflictDirty(['app.js']),
      a.errors.cherryPickDetachedStop,
      a.errors.cherryPickSkipIdle,
      a.errors.conflictForm('stash pop'),
      a.errors.conflictUntrackedStatus('status'),
      a.errors.cherryPickUnverified('README.md'),
      a.errors.form('reset', '--keep', a.allowed.reset),
      a.errors.form('cherry-pick', '-x', a.allowed.cherryPick),
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
      e.resetHard('master', 'abc1234'),
      e.resetHard(null, 'abc1234'),
      e.resetSoft('master', 'abc1234'),
      e.resetSoft(null, 'abc1234'),
      e.resetMixed('master', 'abc1234', false),
      e.resetMixed(null, 'abc1234', true),
      e.resetSameCommit,
      e.resetViaReflog('HEAD@{1}', 'abc1234'),
      e.resetLeftBehind(1),
      e.resetLeftBehind(2),
      e.resetLeftBehind(5),
      e.resetRescued('master', 'abc1234'),
      e.resetNoCommit,
      e.cherryPickDone,
      e.cherryPickDetached,
      e.cherryPickRefusedEdit,
      e.cherryPickRefusedStaged,
      e.cherryPickRefusedUntracked,
      e.cherryPickUsage,
      e.cherryPickBadRevision,
      e.reflogLimited(0),
      e.reflogLimited(3),
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

  it('речь о reset, cherry-pick и журнале: что двигается, три режима, копия с новым id, HEAD@{n} — перемещения, спасение брошенного коммита (target.md, места 13–15)', () => {
    const e = a.explain
    expect(e.resetHard('master', 'abc1234')).toContain('передвинул ветку master вместе с HEAD')
    expect(e.resetHard(null, 'abc1234')).toContain('двигает только HEAD')
    expect(e.resetHard(null, 'abc1234')).toContain('ветки остались на своих местах')
    expect(e.resetSoft('master', 'abc1234')).toContain('Индекс и рабочий каталог не тронуты')
    expect(e.resetMixed('master', 'abc1234', true)).toContain('рабочий каталог не тронут')
    expect(e.resetMixed('master', 'abc1234', true)).toContain('Unstaged changes after reset')
    expect(e.resetMixed('master', 'abc1234', false)).not.toContain('Unstaged changes after reset')
    expect(e.resetViaReflog('HEAD@{1}', 'abc1234')).toContain('а не коммит назад')
    expect(e.resetViaReflog('HEAD@{1}', 'abc1234')).toContain('git reflog')
    expect(e.resetLeftBehind(1)).toContain('git reset --hard HEAD@{n}')
    expect(e.resetLeftBehind(1)).toContain('git branch имя HEAD@{n}')
    expect(e.cherryPickDone).toContain('новый id')
    expect(e.cherryPickDone).toContain('оригинал остался на своём месте')
    expect(e.cherryPickDetached).toContain('двигается только HEAD')
    expect(e.cherryPickRefusedEdit).toContain('git checkout -- app.js')
    expect(e.reflogLimited(0)).toContain('не ошибка')
    expect(e.reflogLimited(3)).toContain('остаются прежними')
    expect(ru.conflicts.cherryPickConflict(['app.js'])).toContain('git cherry-pick --abort')
    expect(ru.conflicts.cherryPickConflict(['app.js'])).toContain('«app.js»')
    expect(ru.conflicts.cherryPickEmpty).toContain('--skip')
  })

  it('списки команд называют reset и cherry-pick, допустимые формы — режимы reset, один коммит cherry-pick, -<число> у журнала', () => {
    for (const text of [a.errors.commandOutOfScope('rebase'), a.errors.gitUsageNoArgs]) {
      expect(text).toContain('reset')
      expect(text).toContain('cherry-pick')
    }
    expect(a.allowed.reset).toContain('--hard')
    expect(a.allowed.cherryPick).toContain('один коммит')
    expect(a.allowed.reflog).toContain('-<число>')
    expect(a.allowed.log).toContain('git log -g --oneline')
    expect(a.errors.revisionForm('reset', 'x')).toContain('HEAD@{n}')
  })

  it('миссии 5 и 6: тексты и подсказки из словаря (target.md, «Миссии»)', () => {
    expect(a.missions.cherryPick.hint).toBe('git cherry-pick feature~1')
    expect(a.missions.cherryPick.text).toContain('git checkout -- app.js')
    expect(a.missions.rescueCommit.hint).toBe('git reset --hard HEAD~1 → git reflog → git reset --hard HEAD@{n}')
    expect(a.missions.rescueCommit.text).toContain('журнал')
  })

  it('число коммитов склоняется: 1 коммит, 2 коммита, 5 коммитов, 11 коммитов, 21 коммит', () => {
    const word = (n: number) => a.explain.leavingBehind(n, 'x').match(/Брошено: \d+ (\S+)\./)?.[1]
    expect([1, 2, 5, 11, 21, 22, 25].map(word)).toEqual(['коммит', 'коммита', 'коммитов', 'коммитов', 'коммит', 'коммита', 'коммитов'])
  })

  it('после reset число брошенных коммитов склоняется так же', () => {
    const word = (n: number) => a.explain.resetLeftBehind(n).match(/на (\d+) (\S+):/)?.[2]
    expect([1, 2, 5, 11, 21].map(word)).toEqual(['коммит', 'коммита', 'коммитов', 'коммитов', 'коммит'])
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

describe('ru.conflicts: речь о конфликтах (target.md, часть XI, «Речь при конфликте»)', () => {
  const c = ru.conflicts
  const texts = (): string[] => [
    c.cherryPickConflict(['app.js']),
    c.cherryPickConflict(['app.js', 'about.html']),
    c.cherryPickEmpty,
    c.stashPopConflict(['app.js']),
    c.stashApplyConflict(['app.js', 'README.md']),
    c.addedWithMarkers(['app.js']),
    c.addedWithMarkers(['a', 'b']),
    c.allAddedCherryPick,
    c.allAddedStash,
    c.cherryPickFinished,
    c.cherryPickFinishedOwnMessage,
    c.editorWouldOpen,
    c.cherryPickSkipped,
    c.cherryPickAborted,
    c.discardedEdit(['app.js']),
    c.discardedEdit(['a', 'b']),
    c.checkoutHeadFile(['app.js'], true),
    c.checkoutHeadFile(['a', 'b'], false),
    c.checkoutCancelled,
    c.operationDroppedByStash,
    c.resetHardCleared,
    c.resetMixedCleared,
    c.stashDropKeepsUnmerged,
    c.commitFinishedStashConflict,
    c.choiceNote('top', 'app.js', 'HEAD', 'ae28885 (fix)', c.finishCherryPick),
    c.choiceNote('bottom', 'app.js', 'Updated upstream', 'Stashed changes', c.finishStash),
    c.choiceNote('both', 'app.js', 'HEAD', 'ae28885 (fix)', c.finishCherryPick),
    c.finishCherryPick,
    c.finishStash,
    c.cherryPickFinish,
    c.cherryPickFinishAdded,
    c.cherryPickAbort,
    c.stashFinish,
    c.stashAbort,
    c.kindBothModified,
    c.kindBothAdded,
  ]

  it('речь не начинается с метки и не выглядит как вывод git: ни error:, ни hint:', () => {
    for (const text of texts()) {
      expect(text.startsWith('[тренажёр]'), text).toBe(false)
      expect(text, text).not.toMatch(/^(fatal|error|usage|hint|warning):/m)
      expect(text, text).not.toMatch(/Auto-merging|CONFLICT \(|needs merge/)
    }
  })

  it('совета merge нет; тайник отвечает на git stash drop, reset --hard и checkout HEAD --, без --abort', () => {
    for (const text of texts()) expect(text, text).not.toMatch(/git merge/)
    expect(c.stashPopConflict(['app.js'])).toContain('git stash drop')
    expect(c.stashPopConflict(['app.js'])).toContain('git reset --hard')
    expect(c.stashPopConflict(['app.js'])).toContain('git checkout HEAD -- <файл>')
    expect(c.stashPopConflict(['app.js'])).toContain('нет --abort')
    expect(c.stashPopConflict(['app.js'])).not.toContain('кнопками справа')
    expect(c.stashPopConflict(['app.js'])).toContain('остался в стопке')
  })

  it('cherry-pick называет git add, --continue, --skip и --abort; метка вверху — HEAD, внизу — копируемый коммит', () => {
    const text = c.cherryPickConflict(['app.js'])
    for (const word of ['git add <файл>', 'git cherry-pick --continue', 'git cherry-pick --skip', 'git cherry-pick --abort', 'вверху (HEAD)', 'внизу']) expect(text).toContain(word)
    expect(c.addedWithMarkers(['app.js'])).toContain('git их не проверяет')
  })

  it('отказы области нового конфликта начинаются с метки [тренажёр] и не выглядят как ошибка git', () => {
    for (const text of [a.errors.cherryPickConflictKind(['a.txt']), a.errors.stashConflictKind('pop', ['a.txt']), a.errors.conflictForm('checkout -'), a.errors.conflictUntrackedStatus('status'), a.errors.cherryPickDetachedStop]) {
      expect(text.startsWith('[тренажёр]'), text).toBe(true)
      expect(text).not.toMatch(/^(fatal|error|usage|hint):/)
    }
  })
})
