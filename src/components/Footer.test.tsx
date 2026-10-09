import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'

describe('Footer', () => {
  it('is the contentinfo landmark and shows exactly the given text', () => {
    const { rerender } = render(<Footer text="First" />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/^First$/)
    rerender(<Footer text="Second" />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/^Second$/)
  })
})
