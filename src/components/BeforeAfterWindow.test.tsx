import { render, screen } from '@testing-library/react'
import { BeforeAfterWindow } from './BeforeAfterWindow'

describe('BeforeAfterWindow', () => {
  it('shows a before and after row per automation project', () => {
    render(<BeforeAfterWindow />)
    const win = screen.getByRole('region', { name: 'автоматизация — до / после' })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(win).toHaveTextContent('bank-statement-automationнесколько часов → 20–30 секунд')
    expect(win).not.toHaveTextContent('payment-registry-automation')
  })
})
