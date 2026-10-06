import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'

describe('Chip', () => {
  it('shows the label and the count', () => {
    render(<Chip label="Проектов" count="[число]" />)
    expect(screen.getByText('Проектов')).toBeInTheDocument()
    expect(screen.getByText('[число]')).toBeInTheDocument()
  })
})
