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
