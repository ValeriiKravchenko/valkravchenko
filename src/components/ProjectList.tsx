import { Chip, type ChipProps } from './Chip'

export interface ProjectItem {
  id: string
  title: string
  description: string
  chip: ChipProps
  /** When present, the title becomes a real link. */
  href?: string
}

export interface ProjectListProps {
  items: ProjectItem[]
}

export function ProjectList({ items }: ProjectListProps) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-2 border-b border-divider py-4 first:pt-0 last:border-b-0 last:pb-0"
        >
          <h3 className="m-0 text-xl font-semibold">
            {item.href ? (
              <a
                href={item.href}
                className="inline-flex min-h-11 items-center text-ink underline decoration-accent underline-offset-4"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>
          <p className="m-0 text-[15px] text-muted">{item.description}</p>
          <div>
            <Chip {...item.chip} />
          </div>
        </li>
      ))}
    </ul>
  )
}
