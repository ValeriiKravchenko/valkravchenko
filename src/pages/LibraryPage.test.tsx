import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { bookCategories, books } from '../data/library'
import { dictionary as t } from '../i18n'
import { pageTitle } from '../i18n/pageTitle'
import { LibraryPage } from './LibraryPage'

const setup = () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>,
  )
  return user
}
const search = () => screen.getByRole('searchbox', { name: t.library.searchLabel })
const status = () => screen.getByText(/^Показано/)
const list = () => screen.getByRole('list', { name: t.library.listLabel })
const catButton = (label: string) => screen.getByRole('button', { name: label })

describe('LibraryPage', () => {
  it('shows heading, intro, labelled search with placeholder and title', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Библиотека')
    expect(screen.getByText('Каталог IT-книг: поиск по названию и фильтр по категориям.')).toBeInTheDocument()
    expect(search()).toHaveAttribute('placeholder', 'Поиск по названию…')
    expect(document.title).toBe(pageTitle(t, t.library.heading))
  })

  it('shows all books initially with a polite counter', () => {
    setup()
    expect(status()).toHaveTextContent(`Показано ${books.length} из ${books.length}`)
    expect(status()).toHaveAttribute('aria-live', 'polite')
    expect(within(list()).getAllByRole('listitem')).toHaveLength(books.length)
  })

  it('shows book title and category label in each item', () => {
    setup()
    const first = within(list()).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent(/\S+/)
    const category = bookCategories.find((c) => c.id === books.find((b) => first.textContent?.includes(b.title))?.category)
    expect(category).toBeDefined()
    expect(first).toHaveTextContent(category!.label)
  })

  it('narrows the list by search and updates the counter', async () => {
    const user = setup()
    await user.type(search(), '  spring  ')
    const expected = books.filter((b) => b.title.toLowerCase().includes('spring')).length
    expect(expected).toBeGreaterThan(0)
    expect(within(list()).getAllByRole('listitem')).toHaveLength(expected)
    expect(status()).toHaveTextContent(`Показано ${expected} из ${books.length}`)
  })

  it('toggles aria-pressed on category buttons and supports several', async () => {
    const user = setup()
    const go = catButton('Go')
    const rust = catButton('Rust')
    expect(go).toHaveAttribute('aria-pressed', 'false')
    expect(go).toHaveAttribute('type', 'button')
    await user.click(go)
    await user.click(rust)
    expect(go).toHaveAttribute('aria-pressed', 'true')
    expect(rust).toHaveAttribute('aria-pressed', 'true')
    const expected = books.filter((b) => b.category === 'go' || b.category === 'rust').length
    expect(status()).toHaveTextContent(`Показано ${expected} из ${books.length}`)
    await user.click(go)
    expect(go).toHaveAttribute('aria-pressed', 'false')
  })

  it('reset restores query, categories and the full list', async () => {
    const user = setup()
    await user.type(search(), 'spring')
    await user.click(catButton('Go'))
    await user.click(screen.getByRole('button', { name: t.library.reset }))
    expect(search()).toHaveValue('')
    expect(catButton('Go')).toHaveAttribute('aria-pressed', 'false')
    expect(status()).toHaveTextContent(`Показано ${books.length} из ${books.length}`)
  })

  it('shows the empty text when nothing matches', async () => {
    const user = setup()
    await user.type(search(), 'zzzz-нет-такой')
    expect(screen.getByText(t.library.empty)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: t.library.listLabel })).toBeNull()
    expect(status()).toHaveTextContent(`Показано 0 из ${books.length}`)
  })

  it('has no links in the book list', () => {
    setup()
    expect(within(list()).queryAllByRole('link')).toHaveLength(0)
    expect(list().querySelectorAll('a, [href]')).toHaveLength(0)
  })

  it('has buttons at least 44px tall', () => {
    setup()
    expect(catButton('Go')).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: t.library.reset })).toHaveClass('min-h-11')
  })
})
