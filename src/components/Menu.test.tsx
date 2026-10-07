import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Menu } from './Menu'

const items = [
  { to: '/', label: 'A' },
  { to: '/b', label: 'B' },
]

function renderMenu(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Menu ariaLabel="Nav" items={items} />
    </MemoryRouter>,
  )
}

describe('Menu', () => {
  it('renders a labelled nav with real links', () => {
    renderMenu()
    expect(screen.getByRole('navigation', { name: 'Nav' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'B' })).toHaveAttribute('href', '/b')
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('links are at least 44px tall', () => {
    renderMenu()
    expect(screen.getByRole('link', { name: 'A' })).toHaveClass('min-h-11')
  })

  it('marks only the active link with aria-current="page"', () => {
    renderMenu('/b')
    expect(screen.getByRole('link', { name: 'B' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'A' })).not.toHaveAttribute('aria-current')
  })
})
