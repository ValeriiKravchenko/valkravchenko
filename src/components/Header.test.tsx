import { render, screen } from '@testing-library/react'
import { Header } from './Header'

describe('Header', () => {
  it('renders the logo link and the navigation', () => {
    render(
      <Header
        logo={{ text: 'VK', ariaLabel: 'Home', href: '#home' }}
        nav={{ ariaLabel: 'Nav', items: [{ href: '#projects', label: 'Projects' }] }}
      />,
    )
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '#home')
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument()
  })
})
