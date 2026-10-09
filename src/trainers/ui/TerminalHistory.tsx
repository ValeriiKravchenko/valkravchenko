import { useDictionary } from '../../i18n'

/** One line of the terminal history: an executed command or a service note. */
export type TerminalHistoryEntry =
  | { kind: 'command'; input: string; ok: boolean; output: string; explanation: string | null }
  | { kind: 'note'; text: string }

export interface TerminalHistoryProps {
  entries: readonly TerminalHistoryEntry[]
  /** Prompt text shown before each command. */
  prompt: string
  /** Hint shown while the history is empty. */
  emptyText: string
}

/**
 * Content of a `TerminalLog`: commands, their output, hints and notes.
 * A failed command is marked by a border and by a hidden prefix for screen readers,
 * so the meaning does not rest on colour alone. Presentation only.
 */
export function TerminalHistory({ entries, prompt, emptyText }: TerminalHistoryProps) {
  const t = useDictionary()

  return (
    <>
      {entries.length === 0 && <p className="m-0 text-term-dim"># {emptyText}</p>}
      {entries.map((entry, i) =>
        entry.kind === 'command' ? (
          <div key={i}>
            <p className="m-0">
              <span className="text-term-prompt">{prompt}</span> {entry.input}
            </p>
            {entry.output && (
              <pre
                className={`m-0 font-[inherit] whitespace-pre-wrap [overflow-wrap:anywhere] ${
                  entry.ok ? '' : 'border-l-2 border-term-dim pl-3'
                }`}
              >
                {!entry.ok && <span className="sr-only">{t.trainers.failedOutput} </span>}
                {entry.output}
              </pre>
            )}
            {entry.explanation && <p className="m-0 mt-1 text-term-prompt">💡 {entry.explanation}</p>}
          </div>
        ) : (
          <p key={i} className="m-0 text-term-dim"># {entry.text}</p>
        ),
      )}
    </>
  )
}
