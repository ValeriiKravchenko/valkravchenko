export type ButtonVariant = 'primary' | 'secondary'

const base =
  'inline-flex min-h-12 min-w-11 items-center justify-center rounded-button px-5 py-2 text-[15px] font-semibold no-underline';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-accent-soft text-accent hover:bg-chip-line',
}

export function buttonClasses(variant: ButtonVariant = 'secondary', className = ''): string {
  return `${base} ${variants[variant]} ${className}`
}
