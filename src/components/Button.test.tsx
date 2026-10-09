import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders a real button with type="button" by default', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button')
  })

  it('calls onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders a real link when href is given', () => {
    render(<Button href="#projects">Projects</Button>)
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '#projects')
  })

  it('primary is the accent button, 48px tall, without a hard shadow', () => {
    render(<Button variant="primary">Go</Button>)
    const el = screen.getByRole('button', { name: 'Go' })
    expect(el).toHaveClass('bg-accent', 'text-on-accent', 'min-h-12', 'rounded-button')
    expect(el).not.toHaveClass('shadow-hard')
    expect(el).not.toHaveClass('btn-primary')
  })

  it('secondary is the soft accent button without a hard shadow', () => {
    render(<Button>Go</Button>)
    const el = screen.getByRole('button', { name: 'Go' })
    expect(el).toHaveClass('bg-accent-soft', 'text-accent')
    expect(el).not.toHaveClass('shadow-hard')
  })
})
