import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'

describe('Chip', () => {
  it('keeps the label and the count in one element so they read as a pair', () => {
    render(<Chip label="Проектов" count="4" />)
    const chip = screen.getByText('Проектов').parentElement!
    expect(chip).toContainElement(screen.getByText('4'))
    expect(chip).toHaveTextContent('Проектов4')
  })

  it('shows a changed count', () => {
    const { rerender } = render(<Chip label="Книг" count="10" />)
    rerender(<Chip label="Книг" count="11" />)
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.queryByText('10')).toBeNull()
  })
})
