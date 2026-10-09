import { render, screen } from '@testing-library/react'
import { Label } from './Label'

describe('Label', () => {
  it('renders text in the mono font by default', () => {
    render(<Label>[число]</Label>)
    expect(screen.getByText('[число]')).toHaveClass('font-mono')
  })

  it('merges an extra class without losing the base ones', () => {
    render(<Label className="uppercase">GITHUB</Label>)
    expect(screen.getByText('GITHUB')).toHaveClass('font-mono', 'uppercase')
  })
})
