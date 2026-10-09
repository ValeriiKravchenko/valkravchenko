import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router'
import { dictionary as t } from '../../i18n'
import { TerminalInput, TerminalLog, TerminalPanel } from './TerminalPanel'
import { TrainerButton } from './TrainerButton'
import { TrainerPanel } from './TrainerPanel'
import { TrainerWindow } from './TrainerWindow'

describe('TrainerPanel', () => {
  it('is a region named by its h2 title', () => {
    render(<TrainerPanel title="Статус">тело</TrainerPanel>)
    const region = screen.getByRole('region', { name: 'Статус' })
    expect(within(region).getByRole('heading', { level: 2, name: 'Статус' })).toBeInTheDocument()
    expect(region).toHaveTextContent('тело')
  })

  it('can use an h3 title', () => {
    render(
      <TrainerPanel title="Вложенная" headingLevel={3}>
        x
      </TrainerPanel>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Вложенная' })).toBeInTheDocument()
  })
})

describe('TrainerButton', () => {
  it('is a real button of type "button" by default and fires onClick', async () => {
    const onClick = vi.fn()
    render(<TrainerButton onClick={onClick}>Нажать</TrainerButton>)
    const button = screen.getByRole('button', { name: 'Нажать' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toContain('min-h-11')
    await userEvent.setup().click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('has a primary variant on the accent tokens', () => {
    render(<TrainerButton variant="primary">Да</TrainerButton>)
    expect(screen.getByRole('button', { name: 'Да' }).className).toContain('bg-accent')
  })
})

describe('TerminalPanel', () => {
  it('shows a titled terminal with a polite log and a labelled input', async () => {
    const ref = createRef<HTMLDivElement>()
    const onChange = vi.fn()
    render(
      <TerminalPanel
        title="Терминал"
        footer={<TerminalInput label="Команда" prompt="$" value="" onChange={onChange} />}
      >
        <TerminalLog ref={ref} label="Вывод">
          строка
        </TerminalLog>
      </TerminalPanel>,
    )
    expect(screen.getByRole('region', { name: 'Терминал' })).toBeInTheDocument()
    const log = screen.getByRole('log', { name: 'Вывод' })
    expect(log).toHaveAttribute('aria-live', 'polite')
    expect(log).toHaveAttribute('tabindex', '0')
    expect(ref.current).toBe(log)
    const input = screen.getByRole('textbox', { name: 'Команда' })
    await userEvent.setup().type(input, 'a')
    expect(onChange).toHaveBeenCalled()
  })

  it('hides the decorative prompt from assistive tech', () => {
    render(<TerminalInput label="Команда" prompt="(main) $" value="" onChange={() => {}} />)
    expect(screen.getByText('(main) $')).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses terminal colour tokens and wraps long lines', () => {
    render(
      <TerminalPanel title="Т">
        <TerminalLog label="Вывод">x</TerminalLog>
      </TerminalPanel>,
    )
    expect(screen.getByRole('region', { name: 'Т' }).className).toContain('bg-term')
    expect(screen.getByRole('log').className).toContain('overflow-wrap:anywhere')
  })
})

describe('TrainerWindow', () => {
  it('wraps the screen in a sky-os window with h1, subheading, intro, actions and a back link', () => {
    render(
      <MemoryRouter>
        <TrainerWindow
          windowTitle="sky-os — тест"
          heading="Заголовок"
          subheading="Подзаголовок"
          intro="Вступление"
          actions={<button type="button">Сброс</button>}
        >
          <p>содержимое</p>
        </TrainerWindow>
      </MemoryRouter>,
    )
    const win = screen.getByRole('region', { name: 'sky-os — тест' })
    expect(within(win).getByRole('heading', { level: 1 })).toHaveTextContent('Заголовок')
    expect(within(win).getByText('Подзаголовок')).toBeInTheDocument()
    expect(within(win).getByText('Вступление')).toBeInTheDocument()
    expect(within(win).getByRole('button', { name: 'Сброс' })).toBeInTheDocument()
    expect(within(win).getByText('содержимое')).toBeInTheDocument()
    expect(within(win).getByRole('link', { name: t.trainers.backLabel })).toHaveAttribute('href', '/trainers')
  })
})
