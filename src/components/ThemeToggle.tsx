import { useDictionary } from '../i18n'
import { useTheme } from '../theme/useTheme'
import { ThemeIcon } from './icons'

/** Theme switch for the system bar: a real button with icon and label. */
export function ThemeToggle() {
  const t = useDictionary()
  const { theme, toggle } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.theme.ariaLabels[theme]}
      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-button border border-toggle-line bg-toggle px-3 text-[14px] font-semibold text-bar-ink"
    >
      <ThemeIcon theme={theme} width={18} height={18} />
      <span>{t.theme.labels[theme]}</span>
    </button>
  )
}
