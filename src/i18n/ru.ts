import type { Dictionary } from './types'

// Placeholders in square brackets are filled in at publication time.
export const ru: Dictionary = {
  siteTitle: 'Валерий Кравченко',
  skipLink: 'Перейти к содержимому',
  logo: { text: 'sky-os', ariaLabel: 'sky-os, на главную' },
  nav: {
    ariaLabel: 'Основная навигация',
    labels: {
      home: 'Главная',
      about: 'Обо мне',
      projects: 'Проекты',
      automation: 'Автоматизация',
      contacts: 'Контакты',
      java: 'Java',
      basics: 'Основы IT',
      trainers: 'Тренажёры',
      library: 'Библиотека',
    },
  },
  systemBar: { language: 'RU', user: 'valerii@sky-os', avatarLabel: 'Обо мне' },
  theme: {
    labels: { day: 'День', night: 'Ночь' },
    ariaLabels: {
      day: 'Тема: день. Переключить на «Ночь»',
      night: 'Тема: ночь. Переключить на «День»',
    },
  },
  dock: { ariaLabel: 'Док', shortLabels: { automation: 'Автомат.', library: 'Библиот.', trainers: 'Тренаж.' } },
  windowMenu: {
    view: { button: 'view', listLabel: 'Вид', themeDay: 'Тема: День', themeNight: 'Тема: Ночь' },
    help: { button: 'help', listLabel: 'Справка', about: 'Обо мне' },
  },
  footer: { text: '© Валерий Кравченко' },
  home: {
    windowTitle: 'sky-os — главная',
    heading: 'Привет, я Валерий',
    lead: 'Здесь будут мои проекты и заметки. Текст страницы появится позже.',
    primaryCta: { section: 'projects', label: 'Смотреть проекты' },
    secondaryCta: { section: 'contacts', label: 'Контакты' },
    chipLabels: { projects: 'Проектов', books: 'Книг' },
    aboutCard: {
      windowTitle: 'about — me',
      name: 'Валерий Кравченко',
      summary: 'Экономист, больше 10 лет автоматизирую рутину через Power Query и pandas, перехожу в Java.',
      button: 'Подробнее',
    },
    terminal: {
      title: 'terminal — ~/projects',
      host: 'valerii@sky-os',
      listCommand: 'ls projects',
      readCommand: 'cat studynotes/about',
      about: 'Сервис заметок на Java: REST API, вход, импорт архива и полнотекстовый поиск.',
      note: '# интерактивный терминал — скоро',
    },
    beforeAfter: {
      title: 'автоматизация — до / после',
      rows: [
        { project: 'bank-statement-automation', before: 'несколько часов', after: '20–30 секунд' },
        { project: 'payment-registry-automation', before: '[до]', after: '[после]' },
      ],
    },
  },
  projects: {
    heading: 'Проекты',
    windowTitle: 'sky-os — проекты',
    linkLabel: 'Код на GitHub',
    pathLinkLabel: 'Открыть тренажёры',
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
      'git-trainer': {
        title: 'Git-тренажёр',
        description:
          'Интерактивный терминал для отработки команд Git по шести разделам: основы, ветвление, осмотр, откаты, командная работа и поиск. Поведение команд описано в документации.',
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
    windowTitle: 'sky-os — автоматизация',
    workflowTitle: 'Как я работаю',
    projectsTitle: 'Проекты',
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
  library: {
    heading: 'Библиотека',
    windowTitle: 'sky-os — библиотека',
    intro: 'Каталог IT-книг: поиск по названию и фильтр по категориям.',
    searchLabel: 'Поиск книги по названию',
    searchPlaceholder: 'Поиск по названию…',
    categoriesLabel: 'Категории',
    reset: 'Сбросить фильтры',
    shown: (shown, total) => `Показано ${shown} из ${total}`,
    listLabel: 'Список книг',
    empty: 'Ничего не найдено — попробуйте изменить запрос или фильтры.',
  },
  trainers: {
    heading: 'Тренажёры',
    windowTitle: 'sky-os — тренажёры',
    intro: 'Два тренажёра, которые работают прямо в браузере. Выберите один.',
    backLabel: '← К тренажёрам',
    loading: 'Загрузка тренажёра…',
    cta: 'Открыть',
    ctaAriaLabel: (title) => `Открыть: ${title}`,
    git: {
      title: 'Git: основы',
      windowTitle: 'sky-os — git: основы',
      listName: 'Основы',
      description:
        'Терминал для отработки команд git: init, status, add, commit. Рядом три области Git, граф коммитов и миссии.',
    },
    gitBranching: { title: 'Git: ветвление', windowTitle: 'sky-os — git: ветвление', listName: 'Ветвление' },
    gitInspecting: {
      title: 'Git: осмотритесь вокруг',
      windowTitle: 'sky-os — git: осмотритесь вокруг',
      listName: 'Осмотритесь вокруг',
    },
    gitUndoing: { title: 'Git: отмена действий', windowTitle: 'sky-os — git: отмена действий', listName: 'Отмена действий' },
    gitCollaborating: {
      title: 'Git: командная работа',
      windowTitle: 'sky-os — git: командная работа',
      listName: 'Командная работа',
    },
    gitSearching: { title: 'Git: поиск', windowTitle: 'sky-os — git: поиск', listName: 'Поиск' },
    gitSectionsLabel: 'Разделы Git',
    gitSectionLink: (number, name) => `Раздел ${number}: ${name}`,
    english: {
      title: 'Английский',
      windowTitle: 'sky-os — английский',
      description:
        'Карточки со словами из рабочей практики и интервальное повторение. Прогресс хранится в вашем браузере.',
    },
    failedOutput: 'Команда не выполнена:',
    missionDone: 'выполнено:',
    missionTodo: 'не выполнено:',
  },
  about: {
    windowTitle: 'sky-os — обо мне',
    heading: 'Обо мне',
    paragraphs: [
      'Я Валерий Кравченко. По специальности экономист, но больше 10 лет занимаюсь не экономическими показателями, а автоматизацией рутины в Power Query. Свожу выгрузки из разных программ в единые таблицы, связываю их по лицевым счетам и составным ключам, разбираю таблицы и извлекаю нужные поля для аналитики, превращаю txt-реестры в нормальные Excel-отчёты. Power Query у меня в работе каждый день, для части задач использую Python и pandas.',
      'Сейчас перехожу в Java-разработку. Основа уже есть: синтаксис, Java Core, Spring Core. Первый проект на Spring Boot — studynotes: REST API, PostgreSQL, Spring Security.',
      'Развиваюсь в трёх направлениях: автоматизация данных, Java-разработка и ИИ (LLM, RAG).',
    ],
    photoAlt: 'Валерий Кравченко',
    buttons: { projects: 'Проекты', github: 'GitHub', contacts: 'Контакты' },
  },
  contacts: {
    heading: 'Контакты',
    windowTitle: 'sky-os — контакты',
    intro: 'Связаться со мной можно так.',
    items: [
      { label: 'GITHUB', value: '[github]' },
      { label: 'EMAIL', value: '[email]' },
    ],
  },
  notFound: {
    windowTitle: 'sky-os — 404',
    heading: 'Страница не найдена',
    body: 'Такой страницы нет. Возможно, адрес набран с ошибкой.',
    homeLink: 'На главную',
  },
}
