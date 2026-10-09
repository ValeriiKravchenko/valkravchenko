import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ABOUT_PATH } from '../data/aboutPaths'
import { useDictionary } from '../i18n'
import { useTheme } from '../theme/useTheme'

// Which menu is open on the page. One store for all windows, so opening a menu
// in one window closes the one open in another.
let openKey: string | null = null
const openListeners = new Set<() => void>()

function setOpenKey(next: string | null): void {
  if (openKey === next) return
  openKey = next
  openListeners.forEach((listener) => listener())
}

function subscribeOpen(listener: () => void): () => void {
  openListeners.add(listener)
  return () => {
    openListeners.delete(listener)
  }
}

const getOpenKey = () => openKey

/** Lets an item close its list and return focus to the button after it is chosen. */
const CloseContext = createContext<() => void>(() => {})

const LIST_WIDTH = 192
const EDGE = 8

interface MenuDropdownProps {
  label: string
  listLabel: string
  children: ReactNode
}

/**
 * Disclosure: a button that shows a list under it. The list is `position: fixed`
 * (not absolute), so the window's `overflow-hidden` does not clip it, and it stays
 * next to the button in the DOM, so Tab order is natural.
 */
function MenuDropdown({ label, listLabel, children }: MenuDropdownProps) {
  const key = useId()
  const listId = useId()
  const current = useSyncExternalStore(subscribeOpen, getOpenKey, getOpenKey)
  const open = current === key
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const close = useCallback(() => {
    if (openKey === key) setOpenKey(null)
  }, [key])

  const closeAndFocus = useCallback(() => {
    close()
    buttonRef.current?.focus()
  }, [close])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - LIST_WIDTH - EDGE)),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndFocus()
    }
    // Tab out of the menu closes it (no focus trap).
    const onFocusIn = (event: FocusEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close()
    }
    const onPointer = (event: Event) => {
      if (!wrapRef.current?.contains(event.target as Node)) close()
    }
    // The fixed list would drift from its button, so it closes on scroll and resize.
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('focusin', onFocusIn)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open, close, closeAndFocus])

  // A menu that unmounts while open must not stay "open" in the store.
  useEffect(() => close, [close])

  return (
    <div
      ref={wrapRef}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpenKey(open ? null : key)}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-button px-2 font-mono text-[13px] text-window-menu hover:underline aria-expanded:underline"
      >
        {label}
      </button>
      {open && (
        <ul
          id={listId}
          aria-label={listLabel}
          style={{ top: pos.top, left: pos.left, width: LIST_WIDTH }}
          className="fixed z-40 m-0 list-none rounded-button border border-border bg-window p-1 shadow-window"
        >
          <CloseContext.Provider value={closeAndFocus}>{children}</CloseContext.Provider>
        </ul>
      )}
    </div>
  )
}

const itemClasses =
  'flex min-h-11 w-full cursor-pointer items-center rounded-button border-0 bg-transparent px-3 text-left font-mono text-[13px] text-ink no-underline hover:underline aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent'

function ThemeItem({ label, pressed, onChoose }: { label: string; pressed: boolean; onChoose: () => void }) {
  const close = useContext(CloseContext)
  return (
    <li>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={() => {
          onChoose()
          close()
        }}
        className={itemClasses}
      >
        {label}
      </button>
    </li>
  )
}

function PageItem({ label, to }: { label: string; to: string }) {
  const close = useContext(CloseContext)
  return (
    <li>
      <Link to={to} onClick={close} className={itemClasses}>
        {label}
      </Link>
    </li>
  )
}

/**
 * Menu in a window title bar: `view` (theme) and `help`. Hidden on narrow
 * screens, where the theme switch is in the system bar.
 */
export function WindowMenu() {
  const t = useDictionary().windowMenu
  const { theme, setTheme } = useTheme()

  const themes = [
    { id: 'day', label: t.view.themeDay },
    { id: 'night', label: t.view.themeNight },
  ] as const

  return (
    <div className="ml-auto hidden shrink-0 gap-1 sm:flex">
      <MenuDropdown label={t.view.button} listLabel={t.view.listLabel}>
        {themes.map((item) => (
          <ThemeItem
            key={item.id}
            label={item.label}
            pressed={theme === item.id}
            onChoose={() => setTheme(item.id)}
          />
        ))}
      </MenuDropdown>
      <MenuDropdown label={t.help.button} listLabel={t.help.listLabel}>
        <PageItem label={t.help.about} to={ABOUT_PATH} />
      </MenuDropdown>
    </div>
  )
}
