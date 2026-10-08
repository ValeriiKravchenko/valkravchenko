import type { Dictionary } from './types'

// Placeholders in square brackets are filled in at publication time.
export const ru: Dictionary = {
  siteTitle: 'Валерий Кравченко',
  skipLink: 'Перейти к содержимому',
  logo: { text: 'VK', ariaLabel: 'Валерий Кравченко, на главную' },
  nav: {
    ariaLabel: 'Основная навигация',
    labels: {
      home: 'Главная',
      projects: 'Проекты',
      automation: 'Автоматизация',
      contacts: 'Контакты',
      java: 'Java',
      basics: 'Основы IT',
      trainers: 'Тренажёры',
      library: 'Библиотека',
    },
  },
  footer: { text: '© Валерий Кравченко' },
  home: {
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
    heading: 'Проекты',
    windowTitle: 'Список проектов',
    linkLabel: 'Код на GitHub',
    newTabNote: '(откроется в новой вкладке)',
    tagsLabel: 'Стек',
    texts: {
      studynotes: {
        title: 'studynotes',
        description:
          'Сервис заметок на Java: REST API, вход и защита от CSRF для одностраничного клиента, импорт архива заметок, полнотекстовый поиск. Тесты идут на настоящей PostgreSQL в Docker, проверки запускаются в CI.',
      },
      'bank-statement-automation': {
        title: 'bank-statement-automation',
        description:
          'Выписки четырёх банков приходят в разных форматах: шапка начинается с разной строки, столбцы называются по-разному. Конвейер сам находит шапку и приводит названия к единому виду через вкладку «Справочник»: новый банк подключается строкой в таблице, без правки кода. Затем добавляет пять аналитических столбцов, которых в выписках нет: филиал, категорию плательщика, услугу, канал сбора и номер документа. 100 000+ операций в месяц: вместо нескольких часов вручную 20–30 секунд.',
      },
      'payment-registry-automation': {
        title: 'payment-registry-automation',
        description:
          'Сбор txt-реестров платежей из папки в одну таблицу: разбор формата, филиал по справочнику договоров вместо цепочки условий, проверка «принято − перечислено = комиссия», сводная по дням и филиалам. Данные выдуманы генератором на Python.',
      },
      valkravchenko: {
        title: 'valkravchenko',
        description:
          'Этот сайт: React, TypeScript и Tailwind, разделы и маршруты из одного реестра, доступность с клавиатуры, проверки в CI.',
      },
    },
    tags: {
      java: 'Java',
      'spring-boot': 'Spring Boot',
      'spring-security': 'Spring Security',
      postgresql: 'PostgreSQL',
      flyway: 'Flyway',
      openapi: 'OpenAPI',
      testcontainers: 'Testcontainers',
      'github-actions': 'GitHub Actions',
      excel: 'Excel',
      'power-query': 'Power Query (M)',
      python: 'Python',
      react: 'React',
      typescript: 'TypeScript',
      tailwind: 'Tailwind CSS',
      vite: 'Vite',
      vitest: 'Vitest',
    },
  },
  automation: {
    heading: 'Автоматизация',
    intro: 'Больше 10 лет автоматизирую обработку данных в Excel и Power Query.',
    workflowTitle: 'Как я работаю',
    tableHeaders: { stage: 'Этап', action: 'Что делаю' },
    workflow: [
      {
        stage: 'Приём',
        action:
          'запрос сам забирает все файлы из папки: txt-реестры из банков и учётных систем, Excel с плавающей шапкой',
      },
      {
        stage: 'Нормализация',
        action:
          'справочник соответствия столбцов между источниками (таблица на листе, а не код), типы данных, отсев служебных строк',
      },
      {
        stage: 'Сопоставление',
        action:
          'связь записей по лицевому счёту, номеру договора, id или составному ключу; номер при необходимости извлекается из текста назначения платежа',
      },
      {
        stage: 'Обогащение',
        action:
          'новые аналитические столбцы по правилам: филиал, категория плательщика, услуга, канал оплаты; каскад по двум полям, исключения, порядок от частного к общему',
      },
      {
        stage: 'Результат',
        action: 'одна таблица под сводные и срезы, обновление одной кнопкой',
      },
    ],
    tools: 'Инструменты: Power Query (каждый день в работе), Python (pandas).',
  },
  contacts: {
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
    heading: 'Страница не найдена',
    body: 'Такой страницы нет. Возможно, адрес набран с ошибкой.',
    homeLink: 'На главную',
  },
}
