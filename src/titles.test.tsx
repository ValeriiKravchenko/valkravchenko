import { renderAt } from './test/renderAt'

// Literals on purpose: these are the exact tab titles the site must show.
describe('document titles', () => {
  it.each([
    ['/', 'Валерий Кравченко'],
    ['/projects', 'Проекты — Валерий Кравченко'],
    ['/automation', 'Автоматизация — Валерий Кравченко'],
    ['/library', 'Библиотека — Валерий Кравченко'],
    ['/trainers', 'Тренажёры — Валерий Кравченко'],
    ['/trainers/git/basics', 'Git: основы — Валерий Кравченко'],
    ['/trainers/git/branching', 'Git: ветвление — Валерий Кравченко'],
    ['/trainers/git/inspecting', 'Git: осмотритесь вокруг — Валерий Кравченко'],
    ['/trainers/git/undoing', 'Git: отмена действий — Валерий Кравченко'],
    ['/trainers/git/collaborating', 'Git: командная работа — Валерий Кравченко'],
    ['/trainers/git/searching', 'Git: поиск — Валерий Кравченко'],
    ['/trainers/english', 'Английский — Валерий Кравченко'],
    ['/about', 'Обо мне — Валерий Кравченко'],
    ['/contacts', 'Контакты — Валерий Кравченко'],
    ['/nope', 'Страница не найдена — Валерий Кравченко'],
  ])('at %s the title is %s', (path, title) => {
    renderAt(path)
    expect(document.title).toBe(title)
  })
})
