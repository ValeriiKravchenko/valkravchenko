import type { ComponentPropsWithoutRef } from 'react'
import { buttonClasses, type ButtonVariant } from './buttonClasses'

interface CommonProps {
  variant?: ButtonVariant
}

export type ButtonAsLinkProps = CommonProps &
  ComponentPropsWithoutRef<'a'> & { href: string }

export type ButtonAsButtonProps = CommonProps &
  ComponentPropsWithoutRef<'button'> & { href?: undefined }

export type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps

/** Renders a real `<a>` when `href` is given, otherwise a real `<button>`. */
export function Button(props: ButtonProps) {
  const { variant = 'secondary', className = '' } = props
  const classes = buttonClasses(variant, className)

  if (props.href !== undefined) {
    const { variant: _v, className: _c, ...anchor } = props
    return <a {...anchor} className={classes} />
  }
  const { variant: _v, className: _c, type = 'button', ...button } = props
  return <button {...button} type={type} className={classes} />
}
