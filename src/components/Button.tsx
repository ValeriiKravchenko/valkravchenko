import type { ComponentPropsWithoutRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary'

interface CommonProps {
  variant?: ButtonVariant
}

export type ButtonAsLinkProps = CommonProps &
  ComponentPropsWithoutRef<'a'> & { href: string }

export type ButtonAsButtonProps = CommonProps &
  ComponentPropsWithoutRef<'button'> & { href?: undefined }

export type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps

const base =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-button px-5 py-2 text-[15px] font-semibold no-underline transition-transform';

const variants: Record<ButtonVariant, string> = {
  primary:
    'btn-primary border-2 border-ink bg-accent text-white shadow-hard active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
  secondary: 'border border-ink bg-window text-ink hover:bg-titlebar',
}

/** Renders a real `<a>` when `href` is given, otherwise a real `<button>`. */
export function Button(props: ButtonProps) {
  const { variant = 'secondary', className = '' } = props
  const classes = `${base} ${variants[variant]} ${className}`

  if (props.href !== undefined) {
    const { variant: _v, className: _c, ...anchor } = props
    return <a {...anchor} className={classes} />
  }
  const { variant: _v, className: _c, type = 'button', ...button } = props
  return <button {...button} type={type} className={classes} />
}
