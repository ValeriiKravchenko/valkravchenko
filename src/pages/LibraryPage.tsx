import { useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { PageHeading } from '../components/PageHeading'
import { Window } from '../components/Window'
import { filterBooks } from '../data/filterBooks'
import { bookCategories, bookCategoryLabel, books, type BookCategoryId } from '../data/library'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { pageTitle } from '../i18n/pageTitle'
import { useDictionary } from '../i18n'

export function LibraryPage() {
  const t = useDictionary()
  useDocumentTitle(pageTitle(t, t.library.heading))

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<BookCategoryId>>(new Set())

  const visible = useMemo(() => filterBooks(books, query, selected), [query, selected])

  const toggle = (id: BookCategoryId) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const reset = () => {
    setQuery('')
    setSelected(new Set())
  }

  return (
    <Window title={t.library.windowTitle} titleAs="p" className="mx-auto max-w-[960px]">
      <PageHeading>{t.library.heading}</PageHeading>
      <p className="mt-4 max-w-[60ch]">{t.library.intro}</p>
      <div className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="library-search" className="text-[15px] font-semibold">
            {t.library.searchLabel}
          </label>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.library.searchPlaceholder}
            className="min-h-11 w-full max-w-[32rem] rounded-button border border-ink bg-window px-4 py-2 text-[16px] text-ink"
          />
        </div>

        <fieldset aria-label={t.library.categoriesLabel} className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
          {bookCategories.map((category) => {
            const pressed = selected.has(category.id)
            return (
              <Button
                key={category.id}
                type="button"
                variant={pressed ? 'primary' : 'secondary'}
                aria-pressed={pressed}
                onClick={() => toggle(category.id)}
                className="!px-4"
              >
                {category.label}
              </Button>
            )
          })}
          <Button type="button" variant="secondary" onClick={reset} className="!px-4">
            {t.library.reset}
          </Button>
        </fieldset>

        <p aria-live="polite" className="m-0 font-mono text-[15px] text-muted">
          {t.library.shown(visible.length, books.length)}
        </p>

        {visible.length > 0 ? (
          <ul
            aria-label={t.library.listLabel}
            className="m-0 flex list-none flex-col gap-3 p-0"
          >
            {visible.map((book) => (
              <li
                key={book.title}
                className="flex min-w-0 flex-col gap-1 border-b border-divider pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">{book.title}</span>
                <span className="shrink-0 font-mono text-[14px] text-muted">
                  {bookCategoryLabel(book.category)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0">{t.library.empty}</p>
        )}
      </div>
    </Window>
  )
}
