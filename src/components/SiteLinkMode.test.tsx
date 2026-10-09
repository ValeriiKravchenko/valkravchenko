import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { SiteLink, SiteLinkMode } from './SiteLinkMode'

describe('SiteLink', () => {
  it('renders a router link by default', () => {
    render(
      <MemoryRouter>
        <SiteLink to="/about">About</SiteLink>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about')
  })

  it('renders a plain anchor with the same attributes inside SiteLinkMode', () => {
    render(
      <MemoryRouter>
        <SiteLinkMode>
          <SiteLink to="/about" className="x" aria-label="Go">
            About
          </SiteLink>
        </SiteLinkMode>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Go' })
    expect(link).toHaveAttribute('href', '/about')
    expect(link).toHaveClass('x')
    expect(link).toHaveTextContent('About')
  })
})
