// ============================================================
// Раздел 8 git-тренажёра: разбор ссылки на коммит (`<ссылка>` в `git tag`, `git branch`, `git log`,
// `git show`, `git checkout`, `git switch`, `git reset`, `git cherry-pick`). Разбирается узкая грамматика, сверенная прогонами (П8.2,
// П8.27, П8.28, П8.30, П8.58, П8.61):
// - `HEAD`, имя ветки, имя тега, 4–40 знаков id коммита и цепочка `~N`, `~`, `^`, `^1`, `^0` после них;
// - `tags/<тег>` и `refs/heads/<ветка>` (с той же цепочкой): полное имя ссылки (П8.58, О11, О12);
// - `HEAD@{n}`, где `n` — десятичное число без ведущих нулей: запись журнала HEAD с номером `n`
//   (target.md, часть X, место 15). Номер считает перемещения HEAD, а не коммиты назад. Цепочка
//   после `HEAD@{n}` не разбирается.
// Всё остальное, что git понимает (`A..B`, `refs/tags/…`, `:/текст`, `v1^{}`, `@{u}`, `master@{1}`),
// разбор не воспроизводит: результат `foreign`, а раздел отвечает отказом области. Ссылка, которую
// git по этой грамматике не нашёл бы, — `missing`: ответ git зависит от команды. `HEAD@{n}` за концом
// журнала — `reflogShort`: ответ git один у всех команд (П8.61).
// ============================================================
import type { AppendixState, AppendixTag } from './appendixTypes'
import { commitOf, currentCommitId } from './appendixRepo'
import { has } from './util'

/** Аннотированный тег, названный словом целиком (без цепочки `~`/`^`). */
export interface AnnotatedTagRef {
  name: string
  tag: Extract<AppendixTag, { kind: 'annotated' }>
}

export type Revision =
  | {
      kind: 'commit'
      id: string
      /** Если слово — точное имя аннотированного тега: сам тег; иначе `null`. */
      annotated: AnnotatedTagRef | null
    }
  | { kind: 'missing' }
  | { kind: 'foreign' }
  /** `HEAD@{n}` за концом журнала HEAD: `entries` — сколько в нём записей. */
  | { kind: 'reflogShort'; entries: number }

const CHAIN = /^(?:~\d*|\^\d*)*$/
const HEX = /^[0-9a-fA-F]{4,40}$/
/** Знаки, которые сразу выводят слово из грамматики: пути, пространства имён, диапазоны, выражения. */
const FOREIGN_CHARS = ['/', ':', '@', '{', '}', '*', '?', '[', ']', '\\', '!', ' ']

function firstParent(state: AppendixState, id: string, steps: number): string | null {
  let current = id
  for (let i = 0; i < steps; i++) {
    const parents = commitOf(state, current).parents
    if (parents.length === 0) return null
    current = parents[0]
  }
  return current
}

/** Применяет цепочку `~N`/`^N` к коммиту; `null`, если родителя нет. */
function applyChain(state: AppendixState, id: string, chain: string): string | null {
  let current: string | null = id
  for (const [, kind, digits] of chain.matchAll(/([~^])(\d*)/g)) {
    if (current === null) return null
    if (kind === '~') current = firstParent(state, current, digits === '' ? 1 : Number(digits))
    else {
      const n = digits === '' ? 1 : Number(digits)
      if (n === 0) continue
      // Коммитов слияния в разделе нет: второго родителя не бывает.
      current = n === 1 ? firstParent(state, current, 1) : null
    }
  }
  return current
}

function baseCommit(state: AppendixState, base: string): { id: string; annotated: AnnotatedTagRef | null } | 'missing' | 'foreign' {
  if (base === 'HEAD') return { id: currentCommitId(state), annotated: null }
  if (has(state.branches, base)) return { id: state.branches[base], annotated: null }
  if (has(state.tags, base)) {
    const tag = state.tags[base]
    return { id: tag.commit, annotated: tag.kind === 'annotated' ? { name: base, tag } : null }
  }
  if (!HEX.test(base)) return 'missing'
  const prefix = base.toLowerCase()
  // Заглавные буквы и id объектов тегов git тоже понимает; модель этого не разбирает.
  if (prefix !== base) return 'foreign'
  if (Object.values(state.tags).some((t) => t.kind === 'annotated' && t.object.startsWith(prefix))) return 'foreign'
  const found = Object.keys(state.commits).filter((id) => id.startsWith(prefix))
  if (found.length === 0) return 'missing'
  if (found.length > 1) return 'foreign'
  return { id: found[0], annotated: null }
}

const REFLOG_REF = /^HEAD@\{(0|[1-9]\d{0,5})\}$/
const QUALIFIED = /^(tags|refs\/heads)\/(.+)$/

/** Ответ git на `HEAD@{n}` за концом журнала, одинаковый у `show`, `log`, `tag`, `branch`, `checkout`, `switch` (П8.61): код 128. */
export function reflogShortOutput(entries: number): string {
  return `fatal: log for 'HEAD' only has ${entries} entries`
}

/** `tags/<тег>` и `refs/heads/<ветка>` с цепочкой `~`/`^`: имя ссылки целиком, поиск только среди тегов или только среди веток. */
function qualifiedRevision(state: AppendixState, prefix: string, rest: string): Revision {
  const cut = rest.search(/[~^]/)
  const name = cut < 0 ? rest : rest.slice(0, cut)
  const chain = cut < 0 ? '' : rest.slice(cut)
  if (name === '' || !CHAIN.test(chain) || FOREIGN_CHARS.some((ch) => name.includes(ch))) return { kind: 'foreign' }
  let found: { id: string; annotated: AnnotatedTagRef | null } | null = null
  if (prefix === 'tags' && has(state.tags, name)) {
    const tag = state.tags[name]
    found = { id: tag.commit, annotated: tag.kind === 'annotated' ? { name, tag } : null }
  } else if (prefix === 'refs/heads' && has(state.branches, name)) {
    found = { id: state.branches[name], annotated: null }
  }
  if (found === null) return { kind: 'missing' }
  if (chain === '') return { kind: 'commit', id: found.id, annotated: found.annotated }
  const moved = applyChain(state, found.id, chain)
  return moved === null ? { kind: 'missing' } : { kind: 'commit', id: moved, annotated: null }
}

/** Разбирает одно слово командной строки как ссылку. */
export function resolveRevision(state: AppendixState, token: string): Revision {
  const reflog = REFLOG_REF.exec(token)
  if (reflog !== null) {
    const n = Number(reflog[1])
    return n < state.reflog.length ? { kind: 'commit', id: state.reflog[n].id, annotated: null } : { kind: 'reflogShort', entries: state.reflog.length }
  }
  const qualified = QUALIFIED.exec(token)
  if (qualified !== null && !token.includes('..')) return qualifiedRevision(state, qualified[1], qualified[2])
  if (token.startsWith('-') || token.startsWith('^') || token.startsWith('~') || token.includes('..')) return { kind: 'foreign' }
  if (FOREIGN_CHARS.some((ch) => token.includes(ch))) return { kind: 'foreign' }
  const cut = token.search(/[~^]/)
  const base = cut < 0 ? token : token.slice(0, cut)
  const chain = cut < 0 ? '' : token.slice(cut)
  if (!CHAIN.test(chain)) return { kind: 'foreign' }
  const found = baseCommit(state, base)
  if (found === 'missing') return { kind: 'missing' }
  if (found === 'foreign') return { kind: 'foreign' }
  if (chain === '') return { kind: 'commit', id: found.id, annotated: found.annotated }
  const moved = applyChain(state, found.id, chain)
  return moved === null ? { kind: 'missing' } : { kind: 'commit', id: moved, annotated: null }
}

/**
 * Ответ git на слово, которое не ссылка и не путь рабочего каталога — одинаковый у `git log` и
 * `git show` (П8.30): `fatal: ambiguous argument …`, код 128. Строка подсказки со словом `<command>` печатается буквально.
 */
export function ambiguousArgumentOutput(token: string): string {
  return [
    `fatal: ambiguous argument '${token}': unknown revision or path not in the working tree.`,
    "Use '--' to separate paths from revisions, like this:",
    "'git <command> [<revision>...] -- [<file>...]'",
  ].join('\n')
}
