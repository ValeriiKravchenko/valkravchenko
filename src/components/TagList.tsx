export interface TagListProps {
  tags: string[]
  /** Accessible name of the list. */
  ariaLabel: string
}

export function TagList({ tags, ariaLabel }: TagListProps) {
  return (
    <ul aria-label={ariaLabel} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {tags.map((tag) => (
        <li
          key={tag}
          className="inline-flex items-center rounded-chip border border-border bg-titlebar px-3 py-1 font-mono text-[15px] text-ink"
        >
          {tag}
        </li>
      ))}
    </ul>
  )
}
