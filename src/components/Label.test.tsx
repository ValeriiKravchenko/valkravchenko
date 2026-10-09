import { render, screen } from '@testing-library/react'
import { Label } from './Label'

describe('Label', () => {
  it('renders text in the mono font by default', () => {
    render(<Label>[число]</Label>)
    expect(screen.getByText('[число]')).toHaveClass('font-mono')
  })

  it('never uses the pixel font', () => {
    render(<Label>GITHUB</Label>)
    expect(screen.getByText('GITHUB')).not.toHaveClass('font-pixel')
  })
})
