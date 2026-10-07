export type ButtonVariant = 'primary' | 'secondary'

const base =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-button px-5 py-2 text-[15px] font-semibold no-underline transition-transform';

const variants: Record<ButtonVariant, string> = {
  primary:
    'btn-primary border-2 border-ink bg-accent text-white shadow-hard active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
  secondary: 'border border-ink bg-window text-ink hover:bg-titlebar',
}

export function buttonClasses(variant: ButtonVariant = 'secondary', className = ''): string {
  return `${base} ${variants[variant]} ${className}`
}
