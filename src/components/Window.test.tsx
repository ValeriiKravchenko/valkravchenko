import { render, screen } from '@testing-library/react'
import { Window } from './Window'

describe('Window', () => {
  it('is a named region with the title as heading', () => {
    render(<Window title="Проекты">Content</Window>)
    expect(screen.getByRole('region', { name: 'Проекты' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Проекты' })).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('hides the decorative dots from assistive tech', () => {
    const { container } = render(<Window title="T">x</Window>)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })

  it('supports a non-heading title', () => {
    render(<Window title="WELCOME" titleAs="p">x</Window>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('has a striped variant', () => {
    const { container } = render(<Window title="T" variant="striped">x</Window>)
    expect(container.querySelector('.titlebar-striped')).not.toBeNull()
    expect(screen.getByRole('region')).toHaveAttribute('data-variant', 'striped')
  })
})
