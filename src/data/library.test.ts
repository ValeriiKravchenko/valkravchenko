import { bookCategories, bookCategoryLabel, books } from './library'

describe('library data', () => {
  // The only place with literal counts: update them when the catalog changes.
  it('has 263 books and 16 categories', () => {
    expect(books).toHaveLength(263)
    expect(bookCategories).toHaveLength(16)
  })

  it('has unique book titles', () => {
    expect(new Set(books.map((b) => b.title)).size).toBe(books.length)
  })

  it('has unique category ids', () => {
    expect(new Set(bookCategories.map((c) => c.id)).size).toBe(bookCategories.length)
  })

  it('gives every book a known category', () => {
    const ids = new Set(bookCategories.map((c) => c.id))
    for (const book of books) expect(ids.has(book.category)).toBe(true)
  })

  it('uses every category at least once', () => {
    const used = new Set(books.map((b) => b.category))
    for (const category of bookCategories) expect(used.has(category.id)).toBe(true)
  })

  it('keeps restored full titles', () => {
    const titles = new Set(books.map((b) => b.title))
    for (const title of [
      'Паттерны разработки на Python. TDD, DDD и событийно-ориентированная архитектура',
      'Программирование на Python с помощью GitHub Copilot',
      'Современный язык Java. Лямбда-выражения, потоки и функциональное программирование',
      'Эволюционная архитектура. Автоматизированное управление программным обеспечением',
      'Active Directory. Проектирование, развертывание и защита',
      'AI-инженерия. Построение приложений с использованием базовых моделей',
      'HTML/CSS. Вся веб-разработка в схемах и иллюстрациях',
      'HTTP/2 в действии',
      'Kafka Streams в действии. Приложения и микросервисы для работы в реальном времени',
      'Kafka Streams в действии. Приложения и микросервисы, управляемые событиями',
    ]) {
      expect(titles.has(title)).toBe(true)
    }
  })

  it('returns the label for a category id', () => {
    expect(bookCategoryLabel('go')).toBe('Go')
  })
})
