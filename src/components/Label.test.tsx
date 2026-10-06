import { render, screen } from '@testing-library/react'
import { Label } from './Label'

describe('Label', () => {
  it('renders text in the mono font by default', () => {
    render(<Label>[число]</Label>)
    expect(screen.getByText('[число]')).toHaveClass('font-mono')
  })

  it('uses the pixel font when requested', () => {
    render(<Label font="pixel">GITHUB</Label>)
    expect(screen.getByText('GITHUB')).toHaveClass('font-pixel')
  })
})
