import { render, screen } from '@testing-library/react'
import { Menu } from './Menu'

describe('Menu', () => {
  it('renders a labelled nav with real links', () => {
    render(
      <Menu
        ariaLabel="Nav"
        items={[
          { href: '#a', label: 'A' },
          { href: '#b', label: 'B' },
        ]}
      />,
    )
    expect(screen.getByRole('navigation', { name: 'Nav' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute('href', '#a')
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('links are at least 44px tall', () => {
    render(<Menu ariaLabel="Nav" items={[{ href: '#a', label: 'A' }]} />)
    expect(screen.getByRole('link', { name: 'A' })).toHaveClass('min-h-11')
  })
})
