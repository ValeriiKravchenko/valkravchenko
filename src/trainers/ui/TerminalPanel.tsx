import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'

export interface TerminalPanelProps {
  title: string
  /** Output area: usually a `TerminalLog`. */
  children: ReactNode
  /** Input row below the output: usually a `TerminalInput`. */
  footer?: ReactNode
  className?: string
}

/** Dark terminal frame (terminal tokens) with a title strip and an optional input row. */
export function TerminalPanel({ title, children, footer, className = '' }: TerminalPanelProps) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className={`flex min-w-0 flex-col overflow-hidden rounded-button border border-term-line bg-term text-term-ink ${className}`}
    >
      <h2
        id={titleId}
        className="m-0 border-b border-term-line px-4 py-2 font-mono text-[13px] font-semibold text-term-dim"
      >
        {title}
      </h2>
      {children}
      {footer}
    </section>
  )
}

export type TerminalLogProps = Omit<ComponentPropsWithoutRef<'div'>, 'role' | 'aria-live'> & {
  /** Accessible name of the log region. */
  label: string
}

/**
 * Scrolling output area. `role="log"` is polite and announces only additions.
 * Long lines wrap, so the page never scrolls sideways.
 */
export const TerminalLog = forwardRef<HTMLDivElement, TerminalLogProps>(function TerminalLog(
  { label, className = '', ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label={label}
      // The log scrolls, so keyboard users must be able to reach it.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={`term-focus min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-5 [overflow-wrap:anywhere] ${className}`}
    />
  )
})

export interface TerminalInputProps
  extends Omit<ComponentPropsWithoutRef<'input'>, 'aria-label' | 'className'> {
  /** Accessible name of the field. */
  label: string
  /** Prompt text shown before the field (decorative, the label carries the name). */
  prompt: string
}

/** Input row of the terminal: decorative prompt plus a labelled field. */
export function TerminalInput({ label, prompt, ...rest }: TerminalInputProps) {
  return (
    <div className="flex items-center gap-2 border-t border-term-line px-4 py-2 font-mono text-[13px]">
      <span aria-hidden="true" className="shrink-0 text-term-prompt">
        {prompt}
      </span>
      <input
        {...rest}
        aria-label={label}
        spellCheck={false}
        autoComplete="off"
        className="term-focus min-h-11 min-w-0 flex-1 rounded-button bg-transparent px-1 text-[16px] text-term-ink placeholder:text-term-dim sm:text-[13px]"
      />
    </div>
  )
}
