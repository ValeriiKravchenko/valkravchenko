import { screen, within } from '@testing-library/react'
import { GITHUB_PROFILE_URL } from '../data/aboutPaths'
import { dictionary as t } from '../i18n'
import { pageTitle } from '../i18n/pageTitle'
import { renderAt } from '../test/renderAt'

describe('AboutPage', () => {
  it('shows the h1, the three paragraphs, the photo and the three links', () => {
    renderAt('/about')
    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent('Обо мне')
    expect(t.about.paragraphs).toHaveLength(3)
    t.about.paragraphs.forEach((text) => expect(within(main).getByText(text)).toBeInTheDocument())

    const img = within(main).getByRole('img', { name: 'Валерий Кравченко' })
    expect(img).toHaveAttribute('srcset', expect.stringMatching(/ 440w, .* 760w$/))
    expect(img).toHaveAttribute('width', '440')
    expect(img).toHaveAttribute('height', '550')
    expect(img).toHaveAttribute('decoding', 'async')

    expect(within(main).getByRole('link', { name: 'Проекты' })).toHaveAttribute('href', '/projects')
    expect(within(main).getByRole('link', { name: 'Контакты' })).toHaveAttribute('href', '/contacts')
    const github = within(main).getByRole('link', { name: 'GitHub' })
    expect(github).toHaveAttribute('href', GITHUB_PROFILE_URL)
    expect(github).toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.title).toBe(pageTitle(t, t.about.heading))
  })

  it('has no current item in the dock or the top menu', () => {
    renderAt('/about')
    const nav = screen.getByRole('navigation', { name: t.nav.ariaLabel })
    const dock = screen.getByRole('navigation', { name: t.dock.ariaLabel })
    expect(nav.querySelector('[aria-current]')).toBeNull()
    expect(dock.querySelector('[aria-current]')).toBeNull()
  })

  it('does not add About to the dock or the top menu', () => {
    renderAt('/about')
    const dock = screen.getByRole('navigation', { name: t.dock.ariaLabel })
    expect(within(dock).queryByRole('link', { name: 'Обо мне' })).toBeNull()
    const nav = screen.getByRole('navigation', { name: t.nav.ariaLabel })
    expect(within(nav).queryByRole('link', { name: 'Обо мне' })).toBeNull()
  })
})
