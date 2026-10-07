import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LinkButton } from './LinkButton'

describe('LinkButton', () => {
  it('renders a real link to the target path', () => {
    render(
      <MemoryRouter>
        <LinkButton to="/projects" variant="primary">
          Go
        </LinkButton>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Go' })
    expect(link).toHaveAttribute('href', '/projects')
    expect(link).toHaveClass('btn-primary', 'min-h-11')
  })
})
