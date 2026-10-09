import { filterBooks } from './filterBooks'
import type { Book } from './library'

const sample: Book[] = [
  { title: 'Spring в действии', category: 'jvm' },
  { title: 'Rust в действии', category: 'rust' },
  { title: 'Алгоритмы', category: 'algorithms' },
  { title: 'Go в действии', category: 'go' },
  { title: 'Python быстро', category: 'python' },
]
const sortedTitles = [...sample].map((b) => b.title).sort((a, b) => a.localeCompare(b, 'ru'))

describe('filterBooks', () => {
  it('returns all books in order for empty query and empty categories', () => {
    expect(filterBooks(sample, '', []).map((b) => b.title)).toEqual(sortedTitles)
    expect(filterBooks(sample, '', new Set()).map((b) => b.title)).toEqual(sortedTitles)
  })

  it('does not mutate the input', () => {
    const copy = [...sample]
    filterBooks(sample, '', [])
    expect(sample).toEqual(copy)
  })

  it('ignores case', () => {
    expect(filterBooks(sample, 'SPRING', [])).toEqual([sample[0]])
    expect(filterBooks(sample, 'алгоРИТМЫ', [])).toEqual([sample[2]])
  })

  it('ignores spaces around the query but keeps inner ones', () => {
    expect(filterBooks(sample, '   rust  ', [])).toEqual([sample[1]])
    expect(filterBooks(sample, '   ', [])).toHaveLength(sample.length)
    expect(filterBooks(sample, 'в действии', [])).toHaveLength(3)
  })

  it('filters by one category', () => {
    expect(filterBooks(sample, '', ['go'])).toEqual([sample[3]])
  })

  it('filters by two categories (union)', () => {
    expect(filterBooks(sample, '', ['go', 'rust']).map((b) => b.title)).toEqual([
      'Go в действии',
      'Rust в действии',
    ])
  })

  it('combines query and category', () => {
    expect(filterBooks(sample, 'действии', ['go', 'python'])).toEqual([sample[3]])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterBooks(sample, 'нет такой книги', [])).toEqual([])
    expect(filterBooks(sample, 'Go', ['rust'])).toEqual([])
  })

  it('sorts with the ru locale', () => {
    const result = filterBooks(sample, '', []).map((b) => b.title)
    expect(result).toEqual([...result].sort((a, b) => a.localeCompare(b, 'ru')))
  })
})
