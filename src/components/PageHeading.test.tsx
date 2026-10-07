import { render, screen } from '@testing-library/react'
import { PageHeading } from './PageHeading'

describe('PageHeading', () => {
  it('is a programmatically focusable h1', () => {
    render(<PageHeading>Title</PageHeading>)
    const h1 = screen.getByRole('heading', { level: 1, name: 'Title' })
    expect(h1).toHaveAttribute('tabindex', '-1')
    h1.focus()
    expect(h1).toHaveFocus()
  })
})
