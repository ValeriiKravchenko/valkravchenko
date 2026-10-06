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

  it('primary has the hard-shadow style and is at least 44px tall', () => {
    render(<Button variant="primary">Go</Button>)
    const el = screen.getByRole('button', { name: 'Go' })
    expect(el).toHaveClass('btn-primary', 'border-2', 'shadow-hard', 'min-h-11')
  })

  it('secondary has no hard shadow', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).not.toHaveClass('shadow-hard')
  })
})
