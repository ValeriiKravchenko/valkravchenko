import { renderAt } from './test/renderAt'

// Literals on purpose: these are the exact tab titles the site must show.
describe('document titles', () => {
  it.each([
    ['/', 'Валерий Кравченко'],
    ['/projects', 'Проекты — Валерий Кравченко'],
    ['/automation', 'Автоматизация — Валерий Кравченко'],
    ['/library', 'Библиотека — Валерий Кравченко'],
    ['/contacts', 'Контакты — Валерий Кравченко'],
    ['/nope', 'Страница не найдена — Валерий Кравченко'],
  ])('at %s the title is %s', (path, title) => {
    renderAt(path)
    expect(document.title).toBe(title)
  })
})
