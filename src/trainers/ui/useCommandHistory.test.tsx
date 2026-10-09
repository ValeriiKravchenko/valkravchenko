import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isCommandEntry, useCommandHistory } from './useCommandHistory'

type Entry =
  | { kind: 'command'; input: string; ok: boolean; output: string }
  | { kind: 'note'; text: string }

const cmd = (input: string, ok = true): Entry => ({ kind: 'command', input, ok, output: ok ? 'out' : 'error: nope' })
const note = (text: string): Entry => ({ kind: 'note', text })

function Harness({ history, onRun = () => {} }: { history: Entry[]; onRun?: (input: string) => void }) {
  const { draft, setDraft, outputRef, onKeyDown } = useCommandHistory(history, onRun)
  return (
    <div>
      <div ref={outputRef} data-testid="output" />
      <input aria-label="field" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
    </div>
  )
}

function field() {
  return screen.getByRole('textbox', { name: 'field' }) as HTMLInputElement
}

describe('isCommandEntry', () => {
  it('is true for commands and false for notes', () => {
    expect(isCommandEntry(cmd('git status'))).toBe(true)
    expect(isCommandEntry(note('hint'))).toBe(false)
  })
})

describe('useCommandHistory', () => {
  it('ArrowUp walks commands from the last to the first and stops at the first', async () => {
    const user = userEvent.setup()
    render(<Harness history={[cmd('one'), cmd('two'), cmd('three')]} />)
    await user.click(field())
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('three')
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('two')
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('one')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(field()).toHaveValue('one')
  })

  it('ArrowDown goes forward and after the last command restores the unsent text', async () => {
    const user = userEvent.setup()
    render(<Harness history={[cmd('one'), cmd('two')]} />)
    await user.type(field(), 'half typed')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(field()).toHaveValue('one')
    await user.keyboard('{ArrowDown}')
    expect(field()).toHaveValue('two')
    await user.keyboard('{ArrowDown}')
    expect(field()).toHaveValue('half typed')
    // history is left: a further ArrowDown changes nothing
    await user.keyboard('{ArrowDown}')
    expect(field()).toHaveValue('half typed')
  })

  it('returns an empty field when nothing was typed before entering the history', async () => {
    const user = userEvent.setup()
    render(<Harness history={[cmd('one')]} />)
    await user.click(field())
    await user.keyboard('{ArrowUp}{ArrowDown}')
    expect(field()).toHaveValue('')
  })

  it('ArrowDown outside the history does nothing', async () => {
    const user = userEvent.setup()
    render(<Harness history={[cmd('one')]} />)
    await user.type(field(), 'abc')
    await user.keyboard('{ArrowDown}')
    expect(field()).toHaveValue('abc')
  })

  it('keeps the first draft when going deeper into the history', async () => {
    const user = userEvent.setup()
    render(<Harness history={[cmd('one'), cmd('two')]} />)
    await user.type(field(), 'draft')
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowDown}{ArrowDown}')
    expect(field()).toHaveValue('draft')
  })

  it('submits a non-empty draft, clears the field and resets the history position', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    render(<Harness history={[cmd('one'), cmd('two')]} onRun={onRun} />)
    await user.click(field())
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(field()).toHaveValue('one')
    await user.keyboard('{Enter}')
    expect(onRun).toHaveBeenCalledWith('one')
    expect(field()).toHaveValue('')
    // the position was reset: ArrowUp starts again from the last command
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('two')
  })

  it('does not submit an empty or blank draft', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    render(<Harness history={[cmd('one')]} onRun={onRun} />)
    await user.click(field())
    await user.keyboard('{Enter}')
    await user.type(field(), '   {Enter}')
    expect(onRun).not.toHaveBeenCalled()
    expect(field()).toHaveValue('   ')
  })

  it('recalls only commands (failed ones included), never notes', async () => {
    const user = userEvent.setup()
    render(<Harness history={[cmd('first'), note('a hint'), cmd('bad', false), note('another')]} />)
    await user.click(field())
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('bad')
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('first')
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('first')
  })

  it('does nothing on arrows when the history is empty or has only notes', async () => {
    const user = userEvent.setup()
    render(<Harness history={[note('only a note')]} />)
    await user.type(field(), 'abc')
    await user.keyboard('{ArrowUp}')
    expect(field()).toHaveValue('abc')
    await user.keyboard('{ArrowDown}')
    expect(field()).toHaveValue('abc')
  })

  it('scrolls the output to the bottom when a new entry appears', () => {
    const { rerender } = render(<Harness history={[cmd('one')]} />)
    const output = screen.getByTestId('output')
    Object.defineProperty(output, 'scrollHeight', { configurable: true, value: 480 })
    output.scrollTop = 0
    rerender(<Harness history={[cmd('one'), cmd('two')]} />)
    expect(output.scrollTop).toBe(480)
  })

  it('does not scroll when the number of entries is unchanged', () => {
    const { rerender } = render(<Harness history={[cmd('one')]} />)
    const output = screen.getByTestId('output')
    Object.defineProperty(output, 'scrollHeight', { configurable: true, value: 480 })
    output.scrollTop = 7
    rerender(<Harness history={[cmd('one')]} />)
    expect(output.scrollTop).toBe(7)
  })
})
