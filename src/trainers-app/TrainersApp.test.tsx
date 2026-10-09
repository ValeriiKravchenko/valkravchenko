import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { dictionary as t } from '../i18n'
import { ru as englishRu } from '../trainers/english/locales/ru'
import { TRAINER_PATHS } from './paths'
import { buildTrainersRoutes } from './routes'
import { TrainersApp } from './TrainersApp'

const renderAt = (path: string) =>
  render(<RouterProvider router={createMemoryRouter(buildTrainersRoutes(), { initialEntries: [path] })} />)

const GIT_PATHS = [
  TRAINER_PATHS.git,
  TRAINER_PATHS.branching,
  TRAINER_PATHS.inspecting,
  TRAINER_PATHS.undoing,
  TRAINER_PATHS.collaborating,
  TRAINER_PATHS.searching,
]

afterEach(() => {
  window.location.hash = ''
})

describe('trainers page entry', () => {
  it('renders the main component and shows the first screen (the list of trainers)', () => {
    render(<TrainersApp />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.trainers.heading)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      t.trainers.git.title,
      t.trainers.english.title,
    ])
  })

  it('uses a hash router: the screen comes from the part after the #', async () => {
    window.location.hash = '#/english'
    render(<TrainersApp />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(englishRu.ui.heading)
    expect(screen.getByRole('region', { name: t.trainers.english.windowTitle })).toBeInTheDocument()
  })

  it('lists the six Git sections and English with in-page links', () => {
    renderAt('/')
    const list = screen.getByRole('list', { name: t.trainers.gitSectionsLabel })
    const links = within(list).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual([
      t.trainers.gitSectionLink(1, t.trainers.git.listName),
      t.trainers.gitSectionLink(2, t.trainers.gitBranching.listName),
      t.trainers.gitSectionLink(3, t.trainers.gitInspecting.listName),
      t.trainers.gitSectionLink(4, t.trainers.gitUndoing.listName),
      t.trainers.gitSectionLink(5, t.trainers.gitCollaborating.listName),
      t.trainers.gitSectionLink(6, t.trainers.gitSearching.listName),
    ])
    expect(links.map((a) => a.getAttribute('href'))).toEqual(GIT_PATHS)
    expect(screen.getByRole('link', { name: t.trainers.ctaAriaLabel(t.trainers.english.title) })).toHaveAttribute(
      'href',
      TRAINER_PATHS.english,
    )
  })

  it('links to the main site with a plain anchor', () => {
    renderAt('/')
    const link = screen.getByRole('link', { name: t.trainers.siteLink })
    expect(link).toHaveAttribute('href', '/')
    expect(link).not.toHaveAttribute('data-discover')
    // Logo and avatar in the system bar also lead out to the main site, not into the hash router.
    expect(screen.getByRole('link', { name: t.logo.ariaLabel })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: t.systemBar.avatarLabel })).toHaveAttribute('href', '/about')
  })

  it.each([
    [TRAINER_PATHS.git, t.trainers.git.windowTitle],
    [TRAINER_PATHS.branching, t.trainers.gitBranching.windowTitle],
    [TRAINER_PATHS.inspecting, t.trainers.gitInspecting.windowTitle],
    [TRAINER_PATHS.undoing, t.trainers.gitUndoing.windowTitle],
    [TRAINER_PATHS.collaborating, t.trainers.gitCollaborating.windowTitle],
    [TRAINER_PATHS.searching, t.trainers.gitSearching.windowTitle],
    [TRAINER_PATHS.english, t.trainers.english.windowTitle],
  ])('%s opens in the window "%s" with one h1', async (path, windowTitle) => {
    renderAt(path)
    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('region', { name: windowTitle })).toContainElement(h1)
    expect(windowTitle).toMatch(/^sky-os — /)
    expect(screen.getByRole('link', { name: t.trainers.backLabel })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: t.trainers.siteLink })).toHaveAttribute('href', '/')
  })

  it.each([
    [TRAINER_PATHS.git, 'Git: основы — Валерий Кравченко'],
    [TRAINER_PATHS.branching, 'Git: ветвление — Валерий Кравченко'],
    [TRAINER_PATHS.inspecting, 'Git: осмотритесь вокруг — Валерий Кравченко'],
    [TRAINER_PATHS.undoing, 'Git: отмена действий — Валерий Кравченко'],
    [TRAINER_PATHS.collaborating, 'Git: командная работа — Валерий Кравченко'],
    [TRAINER_PATHS.searching, 'Git: поиск — Валерий Кравченко'],
    [TRAINER_PATHS.english, 'Английский — Валерий Кравченко'],
    ['/', 'Тренажёры — Валерий Кравченко'],
    ['/nope', 'Страница не найдена — Валерий Кравченко'],
  ])('at %s the title is %s', async (path, title) => {
    renderAt(path)
    await screen.findByRole('heading', { level: 1 })
    expect(document.title).toBe(title)
  })

  it('shows the not-found screen for an unknown route, with a way back to the list', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.notFound.heading)
    expect(screen.getByRole('link', { name: t.trainers.backLabel })).toHaveAttribute('href', '/')
  })

  it('keeps the help menu link to the About page a plain anchor', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    renderAt('/')
    const win = screen.getByRole('region', { name: t.trainers.windowTitle })
    await userEvent.setup().click(within(win).getByRole('button', { name: t.windowMenu.help.button }))
    const about = within(screen.getByRole('list', { name: t.windowMenu.help.listLabel })).getByRole('link', {
      name: t.windowMenu.help.about,
    })
    expect(about).toHaveAttribute('href', '/about')
    expect(about).not.toHaveAttribute('data-discover')
  })
})
