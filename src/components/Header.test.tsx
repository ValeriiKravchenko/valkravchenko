import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Header } from './Header'

describe('Header', () => {
  it('renders the logo link and the navigation', () => {
    render(
      <MemoryRouter>
        <Header
          logo={{ text: 'VK', ariaLabel: 'Home', to: '/' }}
          nav={{ ariaLabel: 'Nav', items: [{ to: '/projects', label: 'Projects' }] }}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects')
  })
})
