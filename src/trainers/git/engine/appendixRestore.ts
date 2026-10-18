// ============================================================
// Раздел 8 git-тренажёра, шаг A: `git checkout -- <файл>…` и `git checkout <файл>…` — вернуть файл
// рабочего каталога к версии из индекса (target.md, часть X, «Что входит», «Вернуть файл»). Нужна
// миссии 5 шага B (П8.10). Вывод сверен с протоколами section8-git-runs.txt (П8.3, П8.10) и
// appendix-g18e2-git-runs.txt (П8.52–П8.55); строки git — английские литералы, не переводятся.
//
// Правила, сверенные прогонами:
// - файл возвращается к версии из индекса, а не из HEAD: подготовленная правка остаётся (П8.53);
// - удалённый из каталога файл создаётся заново (П8.53);
// - «известен git» значит «есть в индексе»: неотслеживаемый файл и файл, удалённый из индекса, дают
//   `error: pathspec '…' did not match any file(s) known to git`, код 1; об каждом неизвестном пути —
//   своя строка в порядке аргументов, и тогда не восстанавливается ничего (П8.52, П8.55);
// - форма с `--` молчит, код 0; форма без `--` печатает `Updated N path(s) from the index`, где N —
//   число файлов, у которых рабочая версия отличалась от индекса (П8.52, П8.55).
// Форма с ссылкой (`git checkout <ссылка> -- <файл>`) берёт файл из коммита и подготавливает его:
// отказ области. Дубликаты без `--` тоже: подсчёт путей git по ним не сверен.
// ============================================================
import type { AppendixState, FileTree } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

/** Слово — путь, который раздел понимает: имя файла рабочего каталога без каталогов, масок и `:`. */
function isPlainPath(path: string): boolean {
  return !/[*?[\]/\\]/.test(path) && !path.startsWith(':') && path !== '.' && path !== '..' && path !== ''
}

export function restoreFiles(state: AppendixState, paths: readonly string[], dashed: boolean): Outcome {
  const foreign = paths.find((p) => !isPlainPath(p))
  if (foreign !== undefined) return refuse(state, ae.pathspecForm('checkout', foreign))
  if (!dashed && new Set(paths).size !== paths.length) return refuse(state, ae.checkoutDuplicate)

  const unknown = paths.filter((p) => !has(state.index, p))
  if (unknown.length > 0) {
    return exited(state, unknown.map((p) => `error: pathspec '${p}' did not match any file(s) known to git`).join('\n'), 1, ax.restorePathspec)
  }

  const distinct = [...new Set(paths)]
  const changed = distinct.filter((p) => !has(state.working, p) || state.working[p] !== state.index[p])
  const working: FileTree = { ...state.working }
  for (const p of changed) working[p] = state.index[p]
  const next: AppendixState = { ...state, working }

  const summary = `Updated ${changed.length} ${changed.length === 1 ? 'path' : 'paths'} from the index`
  const notes = [changed.length > 0 ? ax.restoreDone : ax.restoreNothing]
  if (!dashed) notes.push(ax.restoreWithoutDashes)
  return exited(next, dashed ? '' : summary, 0, notes.join(' '))
}
