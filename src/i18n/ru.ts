import type { Dictionary } from './types'

// Placeholders in square brackets are filled in at publication time.
export const ru: Dictionary = {
  lang: 'ru',
  siteTitle: 'Валерий Кравченко',
  skipLink: 'Перейти к содержимому',
  logo: { text: 'VK', ariaLabel: 'Валерий Кравченко, на главную' },
  nav: {
    ariaLabel: 'Основная навигация',
    labels: {
      home: 'Главная',
      projects: 'Проекты',
      contacts: 'Контакты',
      java: 'Java',
      basics: 'Основы IT',
      trainers: 'Тренажёры',
      library: 'Библиотека',
    },
  },
  footer: { text: '© Валерий Кравченко' },
  home: {
    documentTitle: 'Валерий Кравченко',
    windowTitle: 'WELCOME',
    heading: 'Привет, я Валерий',
    lead: 'Здесь будут мои проекты и заметки. Текст страницы появится позже.',
    primaryCta: { section: 'projects', label: 'Смотреть проекты' },
    secondaryCta: { section: 'contacts', label: 'Контакты' },
    chips: [
      { label: 'Проектов', count: '[число]' },
      { label: 'Книг', count: '[число]' },
    ],
  },
  projects: {
    documentTitle: 'Проекты — Валерий Кравченко',
    heading: 'Проекты',
    windowTitle: 'Список проектов',
    items: [
      {
        id: 'project-1',
        title: '[название проекта 1]',
        description: '[описание проекта]',
        chip: { label: 'Тестов', count: '[число]' },
      },
      {
        id: 'project-2',
        title: '[название проекта 2]',
        description: '[описание проекта]',
        chip: { label: 'Тестов', count: '[число]' },
      },
      {
        id: 'project-3',
        title: '[название проекта 3]',
        description: '[описание проекта]',
        chip: { label: 'Тестов', count: '[число]' },
      },
    ],
  },
  trainer: {
    windowTitle: 'Тренажёр',
    heading: 'Окно тренажёра',
    body: '[описание тренажёра]',
    chip: { label: 'Тестов', count: '[число]' },
  },
  contacts: {
    documentTitle: 'Контакты — Валерий Кравченко',
    heading: 'Контакты',
    windowTitle: 'Контакты',
    intro: 'Связаться со мной можно так.',
    items: [
      { label: 'GITHUB', value: '[github]' },
      { label: 'EMAIL', value: '[email]' },
    ],
  },
  notFound: {
    windowTitle: '404',
    documentTitle: 'Страница не найдена — Валерий Кравченко',
    heading: 'Страница не найдена',
    body: 'Такой страницы нет. Возможно, адрес набран с ошибкой.',
    homeLink: 'На главную',
  },
}
