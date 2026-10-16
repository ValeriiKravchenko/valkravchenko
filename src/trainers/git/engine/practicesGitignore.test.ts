// Сопоставитель .gitignore раздела 7: правила разбора и вердикты. Вердикты на 14 файлах сверены
// с прогонами целиком в practicesProtocol.test.ts; здесь — отдельные правила и поля вердикта.
import { describe, expect, it } from 'vitest'
import { evaluatePath, parseGitignore } from './practicesGitignore'

const verdict = (gitignore: string, path: string) => evaluatePath(parseGitignore(gitignore), path)

describe('parseGitignore', () => {
  it('П7.15 (section7-git-runs.txt:566–588): комментарий, пустые строки и строки из пробелов пропускаются, номер строки считается по файлу, хвостовые пробелы отброшены', () => {
    const rules = parseGitignore('# *.log\n\n   \nREADME.md   \n')
    expect(rules).toHaveLength(1)
    expect(rules[0].line).toBe(4)
    expect(rules[0].source).toBe('README.md')
  })

  it('П7.16 (section7-git-runs.txt:608–628): \\# и \\! в начале — буквальные символы, не комментарий и не исключение', () => {
    const rules = parseGitignore('\\#x\n\\!y\n')
    expect(rules.map((r) => r.negated)).toEqual([false, false])
    expect(verdict('\\#x\n', '#x').ignored).toBe(true)
    expect(verdict('\\!y\n', '!y').ignored).toBe(true)
    expect(verdict('\\#x\n\\!y\n', 'app.js').ignored).toBe(false)
  })

  it('П7.17 (section7-git-runs.txt:648–668): непарная [ ни с чем не совпадает, следующее правило работает', () => {
    const rules = parseGitignore('[unclosed\n*.log\n')
    expect(rules[0].regex).toBeNull()
    expect(verdict('[unclosed\n*.log\n', 'debug.log').rule?.line).toBe(2)
    expect(verdict('[unclosed\n', '[unclosed').ignored).toBe(false)
  })

  it('П7.18: пустой файл — правил нет, ничего не игнорируется', () => {
    expect(parseGitignore('')).toEqual([])
    expect(verdict('', 'debug.log')).toEqual({ ignored: false, rule: null, ignoredPath: null, negationBlockedBy: null })
  })

  it('шаблон из одного «!» и из одного «/» правилом не становится', () => {
    expect(parseGitignore('!\n/\n')).toEqual([])
  })

  it('хвостовой пробел с обратной косой сохраняется как часть шаблона', () => {
    const [rule] = parseGitignore('a\\ \n')
    expect(rule.source).toBe('a\\ ')
    expect(verdict('a\\ \n', 'a ').ignored).toBe(true)
  })

  it('флаги правила: «!», «/» в конце и «/» в начале или середине', () => {
    const [neg, dir, rooted, mid, plain] = parseGitignore('!a.txt\nbuild/\n/todo.txt\nsrc/*.js\nnode_modules\n')
    expect([neg.negated, neg.anchored, neg.dirOnly]).toEqual([true, false, false])
    expect([dir.negated, dir.anchored, dir.dirOnly]).toEqual([false, false, true])
    expect([rooted.anchored, rooted.dirOnly]).toEqual([true, false])
    expect([mid.anchored]).toEqual([true])
    expect([plain.anchored, plain.dirOnly]).toEqual([false, false])
  })
})

describe('evaluatePath: где стоит слэш (П7.2–П7.5, П7.10–П7.12)', () => {
  it('П7.2: имя без слэша совпадает на любом уровне, вердикт даёт правило каталога', () => {
    const v = verdict('node_modules\n', 'packages/ui/node_modules/x.js')
    expect(v.ignored).toBe(true)
    expect(v.rule?.source).toBe('node_modules')
    expect(v.ignoredPath).toBe('packages/ui/node_modules')
  })

  it('П7.3: «build» не задевает src/build.js (имя другое)', () => {
    expect(verdict('build\n', 'src/build.js').ignored).toBe(false)
    expect(verdict('build\n', 'docs/build/index.html').ignored).toBe(true)
  })

  it('П7.4: «build/» — только каталоги; файл с таким именем не подходит', () => {
    expect(verdict('build/\n', 'build').ignored).toBe(false)
    expect(verdict('build/\n', 'docs/build/index.html').ignored).toBe(true)
  })

  it('П7.5: «/build/» привязан к корню', () => {
    expect(verdict('/build/\n', 'build/bundle.js').ignored).toBe(true)
    expect(verdict('/build/\n', 'docs/build/index.html').ignored).toBe(false)
  })

  it('П7.10: слэш в середине привязывает к корню, * не пересекает «/»', () => {
    expect(verdict('src/*.js\n', 'src/build.js').ignored).toBe(true)
    expect(verdict('src/*.js\n', 'docs/src/build.js').ignored).toBe(false)
    expect(verdict('src/*.js\n', 'src/a/b.js').ignored).toBe(false)
  })

  it('П7.11: **/ в начале и /** в конце', () => {
    expect(verdict('**/node_modules\n', 'node_modules/react/index.js').ignored).toBe(true)
    expect(verdict('**/node_modules\n', 'packages/ui/node_modules/x.js').ignored).toBe(true)
    const inside = verdict('logs/**\n', 'logs/error.log')
    expect(inside.ignored).toBe(true)
    expect(inside.ignoredPath).toBe('logs/error.log')
    expect(verdict('logs/**\n', 'debug.log').ignored).toBe(false)
  })

  it('П7.12: /**/ в середине — любое число каталогов, в том числе ноль', () => {
    expect(verdict('docs/**/index.html\n', 'docs/build/index.html').ignored).toBe(true)
    expect(verdict('docs/**/index.html\n', 'docs/index.html').ignored).toBe(true)
    expect(verdict('docs/**/index.html\n', 'build/index.html').ignored).toBe(false)
  })

  it('П7.20: /todo.txt при отсутствующем файле ничего не задевает', () => {
    expect(verdict('/todo.txt\n', 'app.js').ignored).toBe(false)
  })
})

describe('evaluatePath: символы шаблона (П7.13, П7.14)', () => {
  it('П7.13: *.[jc]s? задевает style.css, но не app.js (после точки две буквы вместо трёх)', () => {
    expect(verdict('*.[jc]s?\n', 'style.css').ignored).toBe(true)
    expect(verdict('*.[jc]s?\n', 'app.js').ignored).toBe(false)
  })

  it('П7.14: ?pp.js и *.c[s]s', () => {
    expect(verdict('?pp.js\n', 'app.js').ignored).toBe(true)
    expect(verdict('*.c[s]s\n', 'style.css').ignored).toBe(true)
  })

  it('диапазон, отрицание и класс [:digit:] в перечне (по документации wildmatch, прогонами не сверено)', () => {
    expect(verdict('f[a-c].txt\n', 'fb.txt').ignored).toBe(true)
    expect(verdict('f[a-c].txt\n', 'fd.txt').ignored).toBe(false)
    expect(verdict('f[!a-c].txt\n', 'fd.txt').ignored).toBe(true)
    expect(verdict('f[^a-c].txt\n', 'fa.txt').ignored).toBe(false)
    expect(verdict('f[[:digit:]].txt\n', 'f7.txt').ignored).toBe(true)
  })

  it('* и ? совпадают с точкой в начале имени, как у git (.env* ловит .env.example)', () => {
    expect(verdict('.env*\n', '.env.example').ignored).toBe(true)
    expect(verdict('*.log\n', '.log').ignored).toBe(true)
  })
})

describe('evaluatePath: последнее правило и каталоги (П7.6–П7.9)', () => {
  it('П7.6: *.log, затем !important.log — файл не игнорируется, но правило с «!» названо', () => {
    const v = verdict('*.log\n!important.log\n', 'important.log')
    expect(v.ignored).toBe(false)
    expect(v.rule?.line).toBe(2)
    expect(v.rule?.negated).toBe(true)
    expect(v.ignoredPath).toBeNull()
  })

  it('П7.7: в обратном порядке побеждает *.log', () => {
    const v = verdict('!important.log\n*.log\n', 'important.log')
    expect(v.ignored).toBe(true)
    expect(v.rule?.line).toBe(2)
  })

  it('П7.8: build/ и !build/output.map — файл остаётся игнорируемым, правило каталога, «!» заблокировано', () => {
    const v = verdict('build/\n!build/output.map\n', 'build/output.map')
    expect(v.ignored).toBe(true)
    expect(v.rule?.source).toBe('build/')
    expect(v.ignoredPath).toBe('build')
    expect(v.negationBlockedBy?.source).toBe('!build/output.map')
  })

  it('П7.9: build/* и !build/output.map — файл не игнорируется, bundle.js игнорируется', () => {
    const a = verdict('build/*\n!build/output.map\n', 'build/output.map')
    expect(a.ignored).toBe(false)
    expect(a.rule?.line).toBe(2)
    expect(verdict('build/*\n!build/output.map\n', 'build/bundle.js').ignored).toBe(true)
  })

  it('П7.19: исключение снимает игнорирование, а не включает отслеживание — .env.example не игнорируется', () => {
    const v = verdict('.env*\n!.env.example\n', '.env.example')
    expect(v.ignored).toBe(false)
    expect(v.rule?.source).toBe('!.env.example')
  })
})

// Классы символов, поправки g18b1. Источник: section7-gitignore-fixes-git-runs.txt (П7.46–П7.50).
describe('классы символов: расхождения с git 2.53.0', () => {
  const matched = (rules: string, paths: string[]) => paths.filter((p) => verdict(rules, p).rule !== null)

  it('П7.46: [c-a].txt — перевёрнутый диапазон засчитывает только «c»; правило не пропадает', () => {
    expect(parseGitignore('[c-a].txt\n')[0].regex).not.toBeNull()
    const v = verdict('[c-a].txt\n', 'c/c.txt')
    expect(v.rule?.source).toBe('[c-a].txt')
    expect(v.ignored).toBe(true)
    expect(matched('[c-a].txt\n', ['a/a.txt', 'b/b.txt'])).toEqual([])
  })

  it('П7.47: [c-ab].txt совпадает с b и c, не с a и d', () => {
    expect(matched('[c-ab].txt\n', ['a.txt', 'b.txt', 'c.txt', 'd.txt'])).toEqual(['b.txt', 'c.txt'])
  })

  it('П7.48: [z-a5].txt совпадает с z и 5, не с a и 6', () => {
    expect(matched('[z-a5].txt\n', ['z.txt', 'a.txt', '5.txt', '6.txt'])).toEqual(['z.txt', '5.txt'])
  })

  it('П7.46: обычный диапазон по-прежнему работает, равный концам тоже', () => {
    expect(matched('[a-c].txt\n', ['a.txt', 'b.txt', 'c.txt', 'd.txt'])).toEqual(['a.txt', 'b.txt', 'c.txt'])
    expect(matched('[b-b].txt\n', ['a.txt', 'b.txt'])).toEqual(['b.txt'])
  })

  it('П7.49: *.log, [c-a], !*.txt — каталог c игнорируется правилом 2, !*.txt файлы не возвращает', () => {
    const rules = '*.log\n[c-a]\n!*.txt\n'
    const inDir = verdict(rules, 'c/c.txt')
    expect(inDir.ignored).toBe(true)
    expect(inDir.rule?.line).toBe(2)
    expect(inDir.ignoredPath).toBe('c')
    expect(verdict(rules, 'c/x.log').rule?.line).toBe(2)
    const top = verdict(rules, 'a.txt')
    expect(top.ignored).toBe(false)
    expect(top.rule?.line).toBe(3)
    expect(verdict(rules, 'debug.log').rule?.line).toBe(1)
  })

  it('П7.50: [[:al]x:]].txt — «[» обычный символ перечня, `:]` не найдено до первой `]`', () => {
    const rules = '[[:al]x:]].txt\n'
    expect(parseGitignore(rules)[0].regex).not.toBeNull()
    expect(matched(rules, ['c/ax:]].txt', 'c/:x:]].txt', 'c/al.txt', 'c/x.txt'])).toEqual(['c/ax:]].txt', 'c/:x:]].txt'])
  })

  it('классы [[:alpha:]] по-прежнему работают; неизвестное имя класса — правило не разобрано (как прежде)', () => {
    expect(matched('[[:digit:]].txt\n', ['1.txt', 'a.txt'])).toEqual(['1.txt'])
    expect(parseGitignore('[[:nosuch:]].txt\n')[0].regex).toBeNull()
  })
})
