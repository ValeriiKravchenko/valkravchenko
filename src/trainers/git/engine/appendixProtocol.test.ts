// Проигрывание блоков протоколов настоящего git 2.53.0 на движке раздела 8: вывод и код возврата
// каждой команды сверяются с протоколом (скелет вывода, соответствие id, см. appendixProtocolKit.ts).
// Блоки П8.21–П8.32 лежат в docs/git-trainer/reports/appendix-g18e-git-runs.txt.
import { describe, expect, it } from 'vitest'
import { protocolBlock, replayBlock, type ReplayOptions } from './appendixProtocolKit'

function expectReplay(block: string, options: ReplayOptions = {}): void {
  const replay = replayBlock(block, options)
  const problems = replay.steps
    .filter((s) => s.mismatch !== null)
    .map((s) => `${s.entry.file}:${s.entry.line} «${s.entry.command}» — ${s.mismatch}`)
  expect(problems).toEqual([])
  expect(replay.steps.length).toBeGreaterThan(0)
}

describe('блоки протокола П8.21–П8.40 проигрываются на движке', () => {
  it('П8.21: status во всех сочетаниях индекса, рабочего каталога и неотслеживаемых файлов', () => expectReplay('П8.21'))
  it('П8.22: AM и AD в коротком статусе', () => expectReplay('П8.22'))
  it('П8.23: удаление файла на feature, подготовленное удаление, коммит и show', () => expectReplay('П8.23'))
  it('П8.24: удалённый и новый файл вместе — отказ области вместо status, status -s и diff --staged', () => expectReplay('П8.24', { refused: (_e, i) => [3, 4, 5].includes(i) }))
  it('П8.25: переименование — отказ области вместо status, status -s, diff --staged и show', () => expectReplay('П8.25', { refused: (_e, i) => [6, 7, 8, 10].includes(i) }))
  it('П8.26: add и commit', () => expectReplay('П8.26', { refused: (e) => e.command === 'git commit -m "x" extra' }))
  it('П8.27: формы add', () => expectReplay('П8.27'))
  it('П8.28: branch и checkout (git reflog — шаг B, отказ области)', () => expectReplay('П8.28', { refused: (e) => e.command.startsWith('git reflog') }))
  it('П8.29: создание тегов, порядок проверок, имена', () =>
    expectReplay('П8.29', { skip: (e) => e.command.startsWith('GIT_EDITOR='), until: 28 }))
  it('П8.30: -f, -d, список', () => expectReplay('П8.30', { refused: (e) => e.command === 'git tag -d v9 v9' }))
  it('П8.31: log, show, diff', () => expectReplay('П8.31', { refused: (e) => e.command === 'git log feature master' || e.command === 'git log app.js' }))
  it('П8.32: checkout с двумя причинами отказа', () => expectReplay('П8.32'))

  it('П8.33: commit -a печатает status по индексу с учётом -a, а сам индекс не меняется', () => expectReplay('П8.33'))

  it('П8.34–П8.37: отказ checkout несколькими блоками, порядок блоков', () => {
    for (const block of ['П8.34', 'П8.35', 'П8.36', 'П8.37']) expectReplay(block)
  })
  it('П8.38–П8.40: отчёт о перенесённых файлах строится по индексу', () => {
    for (const block of ['П8.38', 'П8.39', 'П8.40']) expectReplay(block)
  })

  it('в протоколе есть все блоки П8.21–П8.40', () => {
    for (let n = 21; n <= 40; n++) expect(protocolBlock(`П8.${n}`).length, `П8.${n}`).toBeGreaterThan(0)
  })
})

// Блоки П8.41–П8.56 лежат в docs/git-trainer/reports/appendix-g18e2-git-runs.txt. Шаги, на которых
// настоящий git работает, а раздел отвечает отказом области, названы в `refused`; шаги после них
// проигрываются только там, где состояние не зависит от отказа.
describe('блоки протокола П8.41–П8.56 проигрываются на движке', () => {
  it('П8.41: ссылки stash@{n} и номер n, подпись в Dropped', () => expectReplay('П8.41'))
  it('П8.42: слово вместо ссылки при непустой стопке', () => expectReplay('П8.42'))
  it('П8.43: пустая стопка', () => expectReplay('П8.43'))
  it('П8.44: слово, которое называет коммит, и слово, которое не называет ничего', () => expectReplay('П8.44'))
  it('П8.45: создание тайника; сообщение с лишними пробелами и -u — отказ области', () => {
    const lines = ['git stash save "a  b"', 'git stash push -m "  пробелы  "', 'git stash -u foo']
    const refusedAt = protocolBlock('П8.45')
      .map((e, i) => (lines.includes(e.command) ? i : -1))
      .filter((i) => i >= 0)
    // Шаги после отказа сверять нельзя: git сохранил тайник, раздел нет. Блок проигрывается до первого отказа.
    expectReplay('П8.45', { until: refusedAt[0] })
    expect(refusedAt).toHaveLength(3)
  })
  it('П8.47: что попадает в тайник', () => expectReplay('П8.47'))
  it('П8.49: apply и pop при правке в другом файле и в том же файле', () => expectReplay('П8.49'))
  it('П8.50: подготовленная правка того же файла, новый файл в тайнике, неотслеживаемый файл с тем же именем', () => expectReplay('П8.50'))
  it('П8.51: те же правки уже в коммите', () => expectReplay('П8.51'))
  it('П8.52: два файла в отказе; тайник на другой ветке без конфликта', () => expectReplay('П8.52'))
  it('П8.53: checkout -- файл; checkout <ссылка> -- файл — отказ области', () => expectReplay('П8.53', { refused: (e) => e.command === 'git checkout master -- app.js' }))
  it('П8.54: checkout -- файл; status с удалённым и новым файлом вместе — отказ области', () => expectReplay('П8.54', { refused: (e, i) => e.command === 'git status --short' && i === protocolBlock('П8.54').length - 1 }))
  it('П8.55: checkout <файл> без --; дубликат и ссылка — отказ области', () => expectReplay('П8.55', { refused: (e) => e.command === 'git checkout app.js app.js' || e.command === 'git checkout master app.js' }))
  it('П8.56: имя файла совпадает с именем ветки', () => expectReplay('П8.56'))

  it('в протоколе есть все блоки П8.41–П8.56', () => {
    for (let n = 41; n <= 56; n++) expect(protocolBlock(`П8.${n}`).length, `П8.${n}`).toBeGreaterThan(0)
  })
})

