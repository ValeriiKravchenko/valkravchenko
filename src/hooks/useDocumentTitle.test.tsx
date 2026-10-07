import { render } from '@testing-library/react'
import { useDocumentTitle } from './useDocumentTitle'

function Probe({ title }: { title: string }) {
  useDocumentTitle(title)
  return null
}

describe('useDocumentTitle', () => {
  it('sets and updates document.title', () => {
    const { rerender } = render(<Probe title="One" />)
    expect(document.title).toBe('One')
    rerender(<Probe title="Two" />)
    expect(document.title).toBe('Two')
  })
})
