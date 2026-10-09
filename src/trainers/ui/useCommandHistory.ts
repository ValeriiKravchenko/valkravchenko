import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

/** Minimal shape the hook needs: every screen's history entry is a union tagged by `kind`. */
interface TaggedEntry {
  kind: string
}

/** A history entry that is an executed command (carries the typed `input`). */
export type CommandEntryOf<E extends TaggedEntry> = Extract<E, { kind: 'command' }>

/** Narrows a history entry to an executed command (as opposed to a service note). */
export function isCommandEntry<E extends TaggedEntry>(h: E): h is CommandEntryOf<E> {
  return h.kind === 'command'
}

/**
 * Input state of a terminal screen: the text field, ↑/↓ recall of earlier commands
 * and scrolling the output to the bottom when a new entry appears.
 * Only entries of kind 'command' take part in the recall (notes and output do not).
 */
export function useCommandHistory<E extends TaggedEntry & { input?: string }>(
  history: readonly E[],
  onRun: (input: string) => void,
) {
  const [draft, setDraft] = useState('')
  // Text typed before entering the ↑/↓ history: ↓ after the last command brings it back.
  const [pendingDraft, setPendingDraft] = useState<string | null>(null)
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const commandHistory = history.filter(isCommandEntry) as Array<CommandEntryOf<E> & { input: string }>

  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history.length])

  function submit() {
    if (!draft.trim()) return
    onRun(draft)
    setDraft('')
    setHistoryIndex(null)
    setPendingDraft(null)
  }

  function navigateHistory(direction: -1 | 1) {
    if (!commandHistory.length) return
    if (historyIndex === null) {
      if (direction === 1) return
      setPendingDraft(draft)
      setHistoryIndex(commandHistory.length - 1)
      setDraft(commandHistory[commandHistory.length - 1].input)
      return
    }
    const next = historyIndex + direction
    if (next < 0) return
    if (next >= commandHistory.length) {
      setHistoryIndex(null)
      setDraft(pendingDraft ?? '')
      setPendingDraft(null)
      return
    }
    setHistoryIndex(next)
    setDraft(commandHistory[next].input)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') submit()
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigateHistory(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      navigateHistory(1)
    }
  }

  return { draft, setDraft, outputRef, onKeyDown }
}
