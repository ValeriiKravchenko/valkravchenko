import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { dictionary as t } from '../i18n'
import { SystemBar } from './SystemBar'

describe('SystemBar', () => {
  it('has the logo link, the section menu, the theme button and decorative text', () => {
    render(
      <MemoryRouter>
        <SystemBar logoTo="/" items={[{ to: '/projects', label: 'Проекты' }]} />
      </MemoryRouter>,
    )
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: t.logo.ariaLabel })).toHaveAttribute('href', '/')
    expect(
      within(screen.getByRole('navigation', { name: t.nav.ariaLabel })).getByRole('link', {
        name: 'Проекты',
      }),
    ).toHaveAttribute('href', '/projects')
    expect(within(banner).getByRole('button', { name: /^Тема:/ })).toBeInTheDocument()
    expect(within(banner).getByText(t.systemBar.user)).toHaveAttribute('aria-hidden', 'true')
  })

  it('has an avatar link to the About page, visible on every width, with an empty alt', () => {
    render(
      <MemoryRouter>
        <SystemBar logoTo="/" items={[]} />
      </MemoryRouter>,
    )
    const link = within(screen.getByRole('banner')).getByRole('link', { name: t.systemBar.avatarLabel })
    expect(link).toHaveAttribute('href', '/about')
    expect(link).not.toHaveClass('hidden')
    expect(link).toHaveClass('min-h-11', 'min-w-11', 'items-center', 'justify-center')
    const img = link.querySelector('img')
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('srcset', expect.stringMatching(/ 64w, .* 128w$/))
    expect(img).toHaveAttribute('sizes', '28px')
    expect(img).toHaveAttribute('width', '28')
    expect(img).toHaveAttribute('height', '28')
  })

  it('shows the section menu only on wide screens', () => {
    render(
      <MemoryRouter>
        <SystemBar logoTo="/" items={[]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: t.nav.ariaLabel })).toHaveClass('hidden', 'lg:block')
  })
})
