import { render, screen, within } from '@testing-library/react'
import { TagList } from './TagList'

describe('TagList', () => {
  it('renders a labelled list with one item per tag', () => {
    render(<TagList tags={['A', 'B']} ariaLabel="Stack" />)
    const list = screen.getByRole('list', { name: 'Stack' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A', 'B'])
  })
})
