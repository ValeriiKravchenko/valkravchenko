import type { Book, BookCategoryId } from './library'

/**
 * Filters and sorts books. An empty category set does not narrow the list;
 * the query is a case-insensitive substring match, trimmed at both ends.
 * The result is a new array sorted by title (ru locale).
 */
export function filterBooks(
  books: readonly Book[],
  query: string,
  categories: ReadonlySet<BookCategoryId> | readonly BookCategoryId[],
): Book[] {
  const needle = query.trim().toLocaleLowerCase('ru')
  const selected = new Set<BookCategoryId>(categories)
  return books
    .filter(
      (book) =>
        (selected.size === 0 || selected.has(book.category)) &&
        book.title.toLocaleLowerCase('ru').includes(needle),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
}
