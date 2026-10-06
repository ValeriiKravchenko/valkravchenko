import type { Dictionary } from './types'

// Placeholders in square brackets are filled in at publication time.
export const ru: Dictionary = {
  lang: 'ru',
  siteTitle: 'Валерий Кравченко',
  skipLink: 'К содержимому',
  logo: { text: 'VK', ariaLabel: 'Валерий Кравченко, на главную', href: '#home' },
  nav: {
    ariaLabel: 'Основная навигация',
    items: [
      { href: '#home', label: 'Главная' },
      { href: '#projects', label: 'Проекты' },
      { href: '#contacts', label: 'Контакты' },
    ],
  },
  home: {
    windowTitle: 'WELCOME',
    heading: 'Привет, я Валерий',
    lead: 'Здесь будут мои проекты и заметки. Текст страницы появится позже.',
    primaryCta: { href: '#projects', label: 'Смотреть проекты' },
    secondaryCta: { href: '#contacts', label: 'Контакты' },
    chips: [
      { label: 'Проектов', count: '[число]' },
      { label: 'Книг', count: '[число]' },
    ],
  },
  projects: {
    windowTitle: 'Проекты',
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
    windowTitle: 'Контакты',
    intro: 'Связаться со мной можно так.',
    items: [
      { label: 'GITHUB', value: '[github]' },
      { label: 'EMAIL', value: '[email]' },
    ],
  },
}
