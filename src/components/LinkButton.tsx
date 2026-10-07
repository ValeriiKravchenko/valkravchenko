import { Link, type LinkProps } from 'react-router'
import { buttonClasses, type ButtonVariant } from './buttonClasses'

export interface LinkButtonProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant
}

/** Button look for in-site navigation: a real `<a>` handled by the router. */
export function LinkButton({ variant = 'secondary', ...rest }: LinkButtonProps) {
  return <Link {...rest} className={buttonClasses(variant)} />
}
