import { TrainerPanel } from './TrainerPanel'

export interface FileAreaColumn {
  label: string
  files: readonly string[]
}

export interface FileAreasPanelProps {
  title: string
  /** Short facts above the columns, for example the current branch. */
  lines: readonly string[]
  columns: readonly FileAreaColumn[]
  /** Text for an empty column. */
  emptyText: string
  /** Whether the three areas agree (one of two texts), and a hint under it. */
  summary: string
  hint: string
}

/** Panel with the file lists of the working tree, the index and HEAD side by side. Presentation only. */
export function FileAreasPanel({ title, lines, columns, emptyText, summary, hint }: FileAreasPanelProps) {
  return (
    <TrainerPanel title={title} bodyClassName="p-0">
      <div className="px-4 py-3">
        {lines.map((line) => (
          <p key={line} className="m-0 text-muted">
            {line}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-1 divide-y divide-divider border-t border-divider md:grid-cols-3 md:divide-x md:divide-y-0">
        {columns.map((column) => (
          <div key={column.label} className="min-w-0 px-4 py-3">
            <p className="m-0 mb-2 font-mono text-[13px] text-muted">{column.label}</p>
            {column.files.length === 0 ? (
              <p className="m-0 text-muted">{emptyText}</p>
            ) : (
              <ul className="m-0 list-none space-y-1 p-0">
                {column.files.map((f) => (
                  <li key={f} className="[overflow-wrap:anywhere]">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-divider px-4 py-3 text-muted">
        <p className="m-0">{summary}</p>
        <p className="m-0 mt-1">{hint}</p>
      </div>
    </TrainerPanel>
  )
}
