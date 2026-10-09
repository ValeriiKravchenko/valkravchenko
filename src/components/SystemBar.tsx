import { Link } from 'react-router'
import avatar64 from '../assets/about/avatar-64.webp'
import avatar128 from '../assets/about/avatar-128.webp'
import { ABOUT_PATH } from '../data/aboutPaths'
import { useDictionary } from '../i18n'
import { LogoIcon } from './icons'
import { Menu, type MenuItem } from './Menu'
import { ThemeToggle } from './ThemeToggle'

export interface SystemBarProps {
  logoTo: string
  items: MenuItem[]
}

/** Top system bar: logo, section menu (desktop), theme switch, language and user. */
export function SystemBar({ logoTo, items }: SystemBarProps) {
  const t = useDictionary()

  return (
    <header className="sticky top-0 z-30 border-b border-bar-line bg-bar backdrop-blur">
      <div className="flex min-h-11 items-center gap-2 px-4 sm:px-6">
        <Link
          to={logoTo}
          aria-label={t.logo.ariaLabel}
          className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-button font-mono text-[17px] font-semibold text-logo no-underline"
        >
          <LogoIcon width={22} height={22} />
          <span>{t.logo.text}</span>
        </Link>
        <Menu
          items={items}
          ariaLabel={t.nav.ariaLabel}
          className="ml-4 hidden lg:block"
        />
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <span aria-hidden="true" className="hidden font-mono text-[13px] text-bar-muted sm:inline">
            {t.systemBar.language}
          </span>
          <span aria-hidden="true" className="hidden font-mono text-[13px] text-bar-muted sm:inline">
            {t.systemBar.user}
          </span>
          <Link
            to={ABOUT_PATH}
            aria-label={t.systemBar.avatarLabel}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full"
          >
            <img
              src={avatar64}
              srcSet={`${avatar64} 64w, ${avatar128} 128w`}
              sizes="28px"
              width={28}
              height={28}
              alt=""
              className="size-7 rounded-full border border-bar-line object-cover"
            />
          </Link>
        </div>
      </div>
    </header>
  )
}
