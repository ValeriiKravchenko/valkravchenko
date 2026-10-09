import { renderAt } from './test/renderAt'

// Literals on purpose: these are the exact tab titles the site must show.
describe('document titles', () => {
  it.each([
    ['/', 'Валерий Кравченко'],
    ['/projects', 'Проекты — Валерий Кравченко'],
    ['/automation', 'Автоматизация — Валерий Кравченко'],
    ['/library', 'Библиотека — Валерий Кравченко'],
    ['/trainers', 'Тренажёры — Валерий Кравченко'],
    ['/about', 'Обо мне — Валерий Кравченко'],
    ['/contacts', 'Контакты — Валерий Кравченко'],
    ['/trainers/english', 'Страница не найдена — Валерий Кравченко'],
    ['/nope', 'Страница не найдена — Валерий Кравченко'],
  ])('at %s the title is %s', (path, title) => {
    renderAt(path)
    expect(document.title).toBe(title)
  })
})
