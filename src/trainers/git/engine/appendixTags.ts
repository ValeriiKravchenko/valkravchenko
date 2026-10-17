// ============================================================
// Раздел 8 git-тренажёра, шаг A: `git tag` (target.md, часть X, места 1–4; прогоны П8.2, П8.28–П8.30
// в docs/git-trainer/reports/). Формы: создание лёгкого и аннотированного тега, `-f`, список с
// масками, `-d`. Вывод git — английские литералы, не переводятся; всё, что здесь не воспроизводится
// (`-n`, `-s`, `-u`, `-v`, `-F`, `-e`, `--contains` и остальные ключи из usage), получает честный
// отказ области, а не `unknown switch`.
//
// Порядок проверок при создании сверен прогонами: больше двух слов → ссылка не найдена → имя
// недопустимо → тег уже есть → сообщение для аннотированного (П8.28: `git tag "a b" nosuch` и
// `git tag v5 nosuch` отвечают про ссылку, `git tag -a v5` при существующем `v5` — про имя).
// Ошибки с несколькими именами в `-d`: сначала все `error: tag … not found.` по порядку слов, потом
// `Deleted tag …` по порядку слов (П8.29).
// ============================================================
import type { AppendixState, AppendixTag } from './appendixTypes'
import { exited, refuse, type Outcome } from './appendixOutcome'
import { currentCommitId, tagNames } from './appendixRepo'
import { globMatches, isValidTagName } from './appendixRefs'
import { resolveRevision } from './appendixRevisions'
import { markMission } from './appendixMissions'
import { fullCommitId, shortCommitId } from './sectionsCommon'
import { has } from './util'
import { ru } from '../locales/ru'

const ae = ru.appendix.errors
const ax = ru.appendix.explain

/** Usage `git tag` из П8.2 (git 2.53.0), с пустой строкой в конце. */
const TAG_USAGE = [
  'usage: git tag [-a | -s | -u <key-id>] [-f] [-m <msg> | -F <file>] [-e]',
  '               [(--trailer <token>[(=|:)<value>])...]',
  '               <tagname> [<commit> | <object>]',
  '   or: git tag -d <tagname>...',
  '   or: git tag [-n[<num>]] -l [--contains <commit>] [--no-contains <commit>]',
  '               [--points-at <object>] [--column[=<options>] | --no-column]',
  '               [--create-reflog] [--sort=<key>] [--format=<format>]',
  '               [--merged <commit>] [--no-merged <commit>] [<pattern>...]',
  '   or: git tag -v [--format=<format>] <tagname>...',
  '',
  '    -l, --list            list tag names',
  '    -n[<n>]               print <n> lines of each tag message',
  '    -d, --delete          delete tags',
  '    -v, --verify          verify tags',
  '',
  'Tag creation options',
  '    -a, --[no-]annotate   annotated tag, needs a message',
  '    -m, --message <message>',
  '                          tag message',
  '    -F, --[no-]file <file>',
  '                          read message from file',
  '    --trailer <trailer>   add custom trailer(s)',
  '    -e, --[no-]edit       force edit of tag message',
  '    -s, --[no-]sign       annotated and GPG-signed tag',
  '    --[no-]cleanup <mode> how to strip spaces and #comments from message',
  '    -u, --[no-]local-user <key-id>',
  '                          use another key to sign the tag',
  '    -f, --[no-]force      replace the tag if exists',
  '    --[no-]create-reflog  create a reflog',
  '',
  'Tag listing options',
  '    --[no-]column[=<style>]',
  '                          show tag list in columns',
  '    --contains <commit>   print only tags that contain the commit',
  '    --no-contains <commit>',
  "                          print only tags that don't contain the commit",
  '    --merged <commit>     print only tags that are merged',
  '    --no-merged <commit>  print only tags that are not merged',
  '    --[no-]omit-empty     do not output a newline after empty formatted refs',
  '    --[no-]sort <key>     field name to sort on',
  '    --[no-]points-at <object>',
  '                          print only tags of the object',
  '    --[no-]format <format>',
  '                          format to use for the output',
  '    --[no-]color[=<when>] respect format colors',
  '    -i, --[no-]ignore-case',
  '                          sorting and filtering are case insensitive',
  '',
]

/** Полный ответ на неизвестный ключ: строка ошибки и usage, код 129 (П8.2). */
function unknownSwitch(state: AppendixState, error: string): Outcome {
  return exited(state, [error, ...TAG_USAGE].join('\n'), 129)
}

/** Длинные ключи `git tag` из usage П8.2; сокращения и неподдержанные ключи получают отказ области, а не `unknown option`. */
const KNOWN_LONG_OPTIONS = [
  'list',
  'delete',
  'verify',
  'annotate',
  'message',
  'file',
  'trailer',
  'edit',
  'sign',
  'cleanup',
  'local-user',
  'force',
  'create-reflog',
  'column',
  'contains',
  'merged',
  'omit-empty',
  'sort',
  'points-at',
  'format',
  'color',
  'ignore-case',
  'help',
]
const isKnownLongPrefix = (name: string) => KNOWN_LONG_OPTIONS.some((known) => known.startsWith(name) || `no-${known}`.startsWith(name))

/** Короткие ключи из usage, которые тренажёр не разбирает. */
const UNSUPPORTED_SHORT = 'nsuvFeih'

interface TagArguments {
  annotate: boolean
  force: boolean
  list: boolean
  delete: boolean
  message: string | null
  words: string[]
}

/** Разбор слов команды; ответ вместо разбора — ошибка git или отказ области. */
function parseTagArguments(state: AppendixState, args: readonly string[]): TagArguments | Outcome {
  const parsed: TagArguments = { annotate: false, force: false, list: false, delete: false, message: null, words: [] }
  let messages = 0
  const form = (word: string) => refuse(state, ae.form('tag', word, ru.appendix.allowed.tag))
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--') {
      parsed.words.push(...args.slice(i + 1))
      break
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      const name = arg.slice(2, eq < 0 ? undefined : eq)
      if (name === 'annotate' && eq < 0) parsed.annotate = true
      else if (name === 'force' && eq < 0) parsed.force = true
      else if (name === 'list' && eq < 0) parsed.list = true
      else if (name === 'delete' && eq < 0) parsed.delete = true
      else if (name === 'message') {
        messages++
        if (eq >= 0) parsed.message = arg.slice(eq + 1)
        else if (i + 1 < args.length) parsed.message = args[++i]
        else return form(arg)
      } else if (isKnownLongPrefix(name) || eq >= 0) return form(arg)
      else return unknownSwitch(state, `error: unknown option \`${name}'`)
      continue
    }
    if (arg.startsWith('-') && arg.length > 1) {
      let rest = arg.slice(1)
      while (rest.length > 0) {
        const letter = rest[0]
        rest = rest.slice(1)
        if (letter === 'a') parsed.annotate = true
        else if (letter === 'f') parsed.force = true
        else if (letter === 'l') parsed.list = true
        else if (letter === 'd') parsed.delete = true
        else if (letter === 'm') {
          messages++
          if (rest.length > 0) parsed.message = rest
          else if (i + 1 < args.length) parsed.message = args[++i]
          else return exited(state, "error: switch `m' requires a value", 129)
          rest = ''
        } else if (UNSUPPORTED_SHORT.includes(letter)) return form(arg)
        else return unknownSwitch(state, `error: unknown switch \`${letter}'`)
      }
      continue
    }
    parsed.words.push(arg)
  }
  if (messages > 1) return form('-m … -m …')
  return parsed
}

function isOutcome(value: TagArguments | Outcome): value is Outcome {
  return 'result' in value
}

/** Id того, на что указывает тег: коммит у лёгкого, объект у аннотированного (опасное место 2). */
function targetId(tag: AppendixTag): string {
  return tag.kind === 'light' ? tag.commit : tag.object
}

// ---------- список ----------

function listTags(state: AppendixState, patterns: readonly string[]): Outcome {
  let names = tagNames(state)
  if (patterns.length > 0) {
    const unsupported = patterns.find((p) => globMatches(p, '') === null)
    if (unsupported !== undefined) return refuse(state, ae.tagPatternForm(unsupported))
    names = names.filter((name) => patterns.some((p) => globMatches(p, name) === true))
  }
  const explanation = names.length > 0 ? ax.tagListed : patterns.length > 0 ? ax.tagNoMatch : ax.tagNone
  return exited(state, names.join('\n'), 0, explanation)
}

// ---------- удаление ----------

function deleteTags(state: AppendixState, names: readonly string[]): Outcome {
  if (names.length === 0) return exited(state, '', 0, ax.tagDeleteNoNames)
  if (new Set(names).size !== names.length) return refuse(state, ae.tagDeleteDuplicate)
  const missing = names.filter((n) => !has(state.tags, n))
  const existing = names.filter((n) => has(state.tags, n))
  const lines = [
    ...missing.map((n) => `error: tag '${n}' not found.`),
    ...existing.map((n) => `Deleted tag '${n}' (was ${shortCommitId(targetId(state.tags[n]))})`),
  ]
  const tags = { ...state.tags }
  for (const n of existing) delete tags[n]
  const explanation = existing.length > 0 ? ax.tagDeleted : ax.tagNotFound
  return exited({ ...state, tags }, lines.join('\n'), missing.length > 0 ? 1 : 0, explanation)
}

// ---------- создание ----------

function createTag(state: AppendixState, parsed: TagArguments): Outcome {
  const [name, ref] = parsed.words
  if (parsed.words.length > 2) return exited(state, 'fatal: too many arguments', 128)

  let commit = currentCommitId(state)
  if (ref !== undefined) {
    const revision = resolveRevision(state, ref)
    if (revision.kind === 'foreign') return refuse(state, ae.revisionForm('tag', ref))
    if (revision.kind === 'missing') return exited(state, `fatal: Failed to resolve '${ref}' as a valid ref.`, 128)
    // Тег на аннотированный тег — вложенный тег: git указывает на объект тега, модель так не умеет.
    if (revision.annotated !== null) return refuse(state, ae.tagNested(ref))
    commit = revision.id
  }
  if (!isValidTagName(name)) return exited(state, `fatal: '${name}' is not a valid tag name.`, 128, ax.tagInvalidName)
  if (name === '@' || name.includes('/')) return refuse(state, ae.refNameForm('тега', name))
  if (has(state.branches, name)) return refuse(state, ae.tagNameIsBranch(name))
  const old = has(state.tags, name) ? state.tags[name] : undefined
  if (old !== undefined && !parsed.force) return exited(state, `fatal: tag '${name}' already exists`, 128, ax.tagExists)

  const annotated = parsed.annotate || parsed.message !== null
  let tag: AppendixTag = { kind: 'light', commit }
  let clock = state.clock
  if (annotated) {
    if (parsed.message === null) return refuse(state, ae.tagNeedsMessage(name))
    const message = parsed.message.replace(/[ \t\r\n]+$/, '')
    if (message.trim() === '' || message.includes('\n')) return refuse(state, ae.tagMessageForm)
    tag = { kind: 'annotated', object: fullCommitId(`tag ${name}\n${message}`, {}, [commit], clock), commit, message }
    clock++
  }

  const oldId = old === undefined ? null : targetId(old)
  const newId = targetId(tag)
  const moved = oldId !== null && oldId !== newId
  const output = moved ? `Updated tag '${name}' (was ${shortCommitId(oldId)})` : ''
  const unchanged = oldId === newId
  let next: AppendixState = unchanged ? state : { ...state, tags: { ...state.tags, [name]: tag }, clock }
  if (!annotated && !unchanged) next = markMission(next, 'lightTag')
  const speech: string[] = []
  if (moved) speech.push(ax.tagUpdated(name))
  if (annotated) speech.push(ax.tagAnnotated(name))
  else if (unchanged) speech.push(ax.tagForcedSame(name))
  else if (!moved) speech.push(ax.tagLight(name))
  return exited(next, output, 0, speech.join(' '))
}

// ---------- git tag ----------

export function handleTag(state: AppendixState, args: readonly string[]): Outcome {
  const parsed = parseTagArguments(state, args)
  if (isOutcome(parsed)) return parsed
  const creating = parsed.annotate || parsed.force || parsed.message !== null
  if (parsed.delete) {
    if (parsed.list || creating) return refuse(state, ae.form('tag', args.join(' '), ru.appendix.allowed.tag))
    return deleteTags(state, parsed.words)
  }
  if (parsed.list) {
    if (creating) return refuse(state, ae.form('tag', args.join(' '), ru.appendix.allowed.tag))
    return listTags(state, parsed.words)
  }
  if (parsed.words.length === 0) {
    // Ключи создания без имени: git печатает usage; тренажёр его выводом не подделывает.
    if (creating) return refuse(state, ae.form('tag', args.join(' '), ru.appendix.allowed.tag))
    return listTags(state, [])
  }
  return createTag(state, parsed)
}
