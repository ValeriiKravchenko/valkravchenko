import { describe, expect, it } from 'vitest'
import { compareBytes, globMatches, isValidBranchName, isValidRefName, isValidTagName, sortBytes } from './appendixRefs'
import { protocolEntry, where } from './appendixProtocolKit'

describe('порядок байтов', () => {
  it('прописные буквы раньше строчных, цифры раньше букв, дефис раньше цифры (П8.2: v-detached стоит перед v1.0.0 по возрастанию)', () => {
    expect(sortBytes(['v2', 'V1', 'a', '1', 'v-detached', 'v1.0.0'])).toEqual(['1', 'V1', 'a', 'v-detached', 'v1.0.0', 'v2'])
  })

  it('кириллица стоит после латиницы: «Релиз» после v3', () => {
    expect(sortBytes(['Релиз', 'v3', 'a'])).toEqual(['a', 'v3', 'Релиз'])
  })

  it('сравнение идёт по байтам UTF-8, а не по кодовым единицам UTF-16', () => {
    const wide = 'Ａ' // 3 байта: EF BC A1
    const astral = '\u{1F600}' // 4 байта: F0 9F 98 80; в UTF-16 это пара D83D DE00, меньше U+FF21
    expect(wide < astral).toBe(false)
    expect(compareBytes(wide, astral)).toBeLessThan(0)
  })

  it('префикс короче: v1 перед v1.0.0; равные имена равны', () => {
    expect(compareBytes('v1', 'v1.0.0')).toBeLessThan(0)
    expect(compareBytes('v1', 'v1')).toBe(0)
    expect(compareBytes('v1.0.0', 'v1')).toBeGreaterThan(0)
  })

  it('sortBytes не меняет входной массив', () => {
    const names = ['b', 'a']
    sortBytes(names)
    expect(names).toEqual(['b', 'a'])
  })
})

describe('допустимость имени ссылки', () => {
  // Каждое имя из протокола: git ответил «is not a valid tag name» / «is not a valid branch name».
  const invalid: [string, string, string][] = [
    ['a b', 'П8.2', 'git tag "a b"'],
    ['v1..2', 'П8.2', 'git tag v1..2'],
    ['x~1', 'П8.2', 'git tag x~1'],
    ['v1.lock', 'П8.2', 'git tag v1.lock'],
    ['a:b', 'П8.29', 'git tag a:b'],
    ['.x', 'П8.29', 'git tag .x'],
    ['x.', 'П8.29', 'git tag x.'],
    ['x/', 'П8.29', 'git tag "x/"'],
    ['/x', 'П8.29', 'git tag /x'],
    ['a//b', 'П8.29', 'git tag a//b'],
    ['a@{1}', 'П8.29', 'git tag "a@{1}"'],
    ['a^b', 'П8.29', 'git tag "a^b"'],
    ['a?b', 'П8.29', 'git tag "a?b"'],
    ['a[b', 'П8.29', 'git tag "a[b"'],
    ['', 'П8.29', 'git tag ""'],
  ]
  for (const [name, block, command] of invalid) {
    it(`«${name}» недопустимо — git отвечает ошибкой имени (${block})`, () => {
      expect(isValidRefName(name)).toBe(false)
      expect(protocolEntry(block, command).output).toContain('is not a valid tag name.')
    })
  }

  it('допустимые имена: v1.0.0, v1.2.0-rc, Релиз, release-2, name_with_underscore', () => {
    for (const name of ['v1.0.0', 'v1.2.0-rc', 'Релиз', 'release-2', 'name_with_underscore', 'feature/x', 'a.b']) expect(isValidRefName(name)).toBe(true)
  })

  it('управляющий знак и DEL недопустимы', () => {
    expect(isValidRefName('a\tb')).toBe(false)
    expect(isValidRefName('a\u007fb')).toBe(false)
  })

  it(`тег HEAD и тег с дефисом в начале недопустимы (${where('П8.29', 'git tag HEAD')}, ${where('П8.2', 'git tag -- -x')})`, () => {
    expect(isValidTagName('HEAD')).toBe(false)
    expect(isValidTagName('-x')).toBe(false)
    expect(isValidTagName('v1')).toBe(true)
  })

  it(`ветка HEAD и ветка с дефисом в начале недопустимы (${where('П8.28', 'git branch HEAD')}, ${where('П8.28', 'git branch -- -x')})`, () => {
    expect(isValidBranchName('HEAD')).toBe(false)
    expect(isValidBranchName('-x')).toBe(false)
    expect(isValidBranchName('x.lock')).toBe(false)
    expect(isValidBranchName('topic')).toBe(true)
  })
})

describe('маска имён', () => {
  it('* — любая последовательность, в том числе пустая и со слешем', () => {
    expect(globMatches('v1.*', 'v1.0.0')).toBe(true)
    expect(globMatches('v*', 'v')).toBe(true)
    expect(globMatches('*', 'rel/1')).toBe(true)
    expect(globMatches('v1.1*', 'v1.0.0')).toBe(false)
  })

  it('? — ровно один знак, в том числе из кириллицы', () => {
    expect(globMatches('v?', 'v1')).toBe(true)
    expect(globMatches('v?', 'v10')).toBe(false)
    expect(globMatches('?', 'я')).toBe(true)
  })

  it('класс [a-z], отрицание [!a] и [^a], знак ] первым в классе', () => {
    expect(globMatches('v[1-5]', 'v3')).toBe(true)
    expect(globMatches('v[1-5]', 'v7')).toBe(false)
    expect(globMatches('v[!1]', 'v2')).toBe(true)
    expect(globMatches('v[^1]', 'v1')).toBe(false)
    expect(globMatches('[]x]', ']')).toBe(true)
    expect(globMatches('v[12]', 'v2')).toBe(true)
  })

  it('имя без знаков маски совпадает только целиком', () => {
    expect(globMatches('v1', 'v1')).toBe(true)
    expect(globMatches('v1', 'v10')).toBe(false)
  })

  it('обратная косая и класс [:alpha:] не разбираются: null', () => {
    expect(globMatches('a\\*', 'a*')).toBeNull()
    expect(globMatches('[[:alpha:]]', 'a')).toBeNull()
    expect(globMatches('[abc', 'a')).toBeNull()
  })

  it('hiddenLiteral: имя с точки совпадает, только если точка в маске', () => {
    expect(globMatches('*', '.hidden', { hiddenLiteral: true })).toBe(false)
    expect(globMatches('.h*', '.hidden', { hiddenLiteral: true })).toBe(true)
    expect(globMatches('*', '.hidden')).toBe(true)
  })
})
