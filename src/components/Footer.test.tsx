import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'

describe('Footer', () => {
  it('renders a contentinfo landmark with the text', () => {
    render(<Footer text="Note" />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Note')
  })
})
