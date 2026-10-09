import type { ComponentPropsWithoutRef } from 'react'

export type TrainerButtonVariant = 'primary' | 'secondary'

export interface TrainerButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'className'> {
  variant?: TrainerButtonVariant
  className?: string
}

const base =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-button border px-4 py-2 text-[15px] font-semibold'

const variants: Record<TrainerButtonVariant, string> = {
  primary: 'border-accent bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border-chip-line bg-accent-soft text-accent hover:bg-chip-line',
}

/** Compact real `<button>` for trainers: at least 44 px tall, site colour tokens. */
export function TrainerButton({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: TrainerButtonProps) {
  return <button {...rest} type={type} className={`${base} ${variants[variant]} ${className}`} />
}
