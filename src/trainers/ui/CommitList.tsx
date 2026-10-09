export interface CommitListItem {
  id: string
  message: string
  /** Labels on the commit: branches, HEAD, origin/<branch>. Shown as text chips. */
  tags: readonly string[]
  /** Text for a merge commit, for example "parents: a + b". */
  parents?: string
  /** Remark under the commit. Together with `faded` it explains why the commit is shown dimmed. */
  note?: string
  /** Commit that no branch reaches: dashed border and muted text, never colour alone. */
  faded?: boolean
}

/**
 * Commit graph as a text list, newest first. There are no drawn lines: every
 * fact (id, message, parents, branch labels, unreachable state) is text, so the
 * list reads the same for a screen reader and needs no image alternative.
 * Presentation only.
 */
export function CommitList({ commits }: { commits: readonly CommitListItem[] }) {
  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {commits.map((c) => (
        <li
          key={c.id}
          data-faded={c.faded ? 'true' : undefined}
          className={c.faded ? 'rounded-button border border-dashed border-chip-line p-2 text-muted' : ''}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-accent">{c.id}</span>
            <span className="[overflow-wrap:anywhere]">{c.message}</span>
            {c.parents && <span className="font-mono text-[13px] text-muted">{c.parents}</span>}
            {c.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-chip border border-chip-line bg-chip px-1.5 font-mono text-[13px] text-muted [overflow-wrap:anywhere]"
              >
                {tag}
              </span>
            ))}
          </div>
          {c.note && <p className="m-0 mt-1 text-[14px] text-accent">💡 {c.note}</p>}
        </li>
      ))}
    </ul>
  )
}
