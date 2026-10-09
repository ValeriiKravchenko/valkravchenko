import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router'
import { dictionary as t } from '../../i18n'
import { CommitList } from './CommitList'
import { FileAreasPanel } from './FileAreas'
import { TerminalHistory } from './TerminalHistory'
import { TerminalInput, TerminalLog, TerminalPanel } from './TerminalPanel'
import { TrainerButton } from './TrainerButton'
import { TrainerMissions } from './TrainerMissions'
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
    expect(within(win).getByRole('link', { name: t.trainers.backLabel })).toHaveAttribute('href', '/')
    // The main site is reached with a plain anchor (full page load), not a router link.
    expect(within(win).getByRole('link', { name: t.trainers.siteLink })).toHaveAttribute('href', '/')
  })
})

describe('TerminalHistory', () => {
  it('shows the hint while the history is empty', () => {
    render(<TerminalHistory entries={[]} prompt="$" emptyText="введи команду" />)
    expect(screen.getByText('# введи команду')).toBeInTheDocument()
  })

  it('shows commands, notes and the explanation', () => {
    render(
      <TerminalHistory
        prompt="(main) $"
        emptyText="пусто"
        entries={[
          { kind: 'command', input: 'git status', ok: true, output: 'чисто', explanation: 'пояснение' },
          { kind: 'note', text: 'заметка' },
        ]}
      />,
    )
    expect(screen.getByText('git status')).toBeInTheDocument()
    expect(screen.getByText('(main) $')).toBeInTheDocument()
    expect(screen.getByText('чисто')).toBeInTheDocument()
    expect(screen.getByText(/пояснение/)).toBeInTheDocument()
    expect(screen.getByText('# заметка')).toBeInTheDocument()
    expect(screen.queryByText('# пусто')).toBeNull()
  })

  it('marks a failed command with a hidden prefix for screen readers, not by colour alone', () => {
    render(
      <TerminalHistory
        prompt="$"
        emptyText=""
        entries={[{ kind: 'command', input: 'ls', ok: false, output: 'нет такой команды', explanation: null }]}
      />,
    )
    const output = screen.getByText('нет такой команды', { exact: false })
    expect(within(output).getByText(t.trainers.failedOutput, { exact: false })).toHaveClass('sr-only')
    expect(output.className).toContain('border-l-2')
  })
})

describe('TrainerMissions', () => {
  it('names the state of each mission in text', () => {
    render(
      <TrainerMissions
        title="Что попробовать"
        missions={[
          { id: 'a', text: 'Первая', hint: 'git a', done: true },
          { id: 'b', text: 'Вторая', hint: 'git b', done: false },
        ]}
      />,
    )
    expect(screen.getByRole('region', { name: 'Что попробовать' })).toBeInTheDocument()
    const done = screen.getByText('Первая', { exact: false }).closest('li')!
    const todo = screen.getByText('Вторая', { exact: false }).closest('li')!
    expect(done).toHaveAttribute('data-done', 'true')
    expect(within(done).getByText(t.trainers.missionDone, { exact: false })).toHaveClass('sr-only')
    expect(todo).toHaveAttribute('data-done', 'false')
    expect(within(todo).getByText(t.trainers.missionTodo, { exact: false })).toHaveClass('sr-only')
  })
})

describe('FileAreasPanel', () => {
  it('shows the lines, a column per area, the empty text and the summary', () => {
    render(
      <FileAreasPanel
        title="Статус"
        lines={['Текущая ветка: main']}
        columns={[
          { label: 'Рабочее дерево', files: ['a.txt', 'b.txt'] },
          { label: 'Индекс', files: [] },
        ]}
        emptyText="пусто"
        summary="Есть расхождения"
        hint="Подробности в git status"
      />,
    )
    const panel = screen.getByRole('region', { name: 'Статус' })
    expect(within(panel).getByText('Текущая ветка: main')).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['a.txt', 'b.txt'])
    expect(within(panel).getByText('пусто')).toBeInTheDocument()
    expect(within(panel).getByText('Есть расхождения')).toBeInTheDocument()
    expect(within(panel).getByText('Подробности в git status')).toBeInTheDocument()
  })
})

describe('CommitList', () => {
  it('writes every fact of a commit as text', () => {
    render(
      <CommitList
        commits={[
          { id: 'abc1234', message: 'Слияние', tags: ['HEAD → main', 'dev'], parents: 'родители: a + b' },
        ]}
      />,
    )
    const item = screen.getByRole('listitem')
    expect(item).toHaveTextContent('abc1234')
    expect(item).toHaveTextContent('Слияние')
    expect(item).toHaveTextContent('родители: a + b')
    expect(within(item).getByText('HEAD → main')).toBeInTheDocument()
    expect(within(item).getByText('dev')).toBeInTheDocument()
    expect(item).not.toHaveAttribute('data-faded')
  })

  it('marks an unreachable commit with a dashed border and a remark, not by dimming alone', () => {
    render(<CommitList commits={[{ id: 'f00', message: 'Потерян', tags: [], faded: true, note: 'Ни одна ветка не ведёт сюда' }]} />)
    const item = screen.getByRole('listitem')
    expect(item).toHaveAttribute('data-faded', 'true')
    expect(item.className).toContain('border-dashed')
    expect(item.className).not.toContain('opacity')
    expect(within(item).getByText(/Ни одна ветка не ведёт сюда/)).toBeInTheDocument()
  })
})
