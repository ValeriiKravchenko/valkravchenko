import { Link } from 'react-router'
import { TagList } from './TagList'

export interface ProjectItem {
  id: string
  title: string
  description: string
  tags: string[]
  tagsLabel: string
  link: {
    href: string
    label: string
    /** Accessible name: title plus the new-tab note (external links only). */
    ariaLabel: string
    /** In-site link: opens in the same tab through the router. */
    internal?: boolean
  }
}

export interface ProjectListProps {
  items: ProjectItem[]
  /** Heading level of each project title: one below the surrounding heading. */
  headingLevel: 2 | 3
}

const linkClass =
  'inline-flex min-h-11 items-center text-accent underline decoration-teal-deco underline-offset-4 hover:text-accent-hover'

export function ProjectList({ items, headingLevel }: ProjectListProps) {
  const Heading = `h${headingLevel}` as const
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 border-b border-divider py-5 first:pt-0 last:border-b-0 last:pb-0"
        >
          <Heading className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{item.title}</Heading>
          <p className="m-0 text-[15px] text-muted">{item.description}</p>
          <TagList tags={item.tags} ariaLabel={`${item.tagsLabel}: ${item.title}`} />
          <div>
            {item.link.internal ? (
              <Link to={item.link.href} aria-label={item.link.ariaLabel} className={linkClass}>
                {item.link.label}
              </Link>
            ) : (
              <a
                href={item.link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.link.ariaLabel}
                className={linkClass}
              >
                {item.link.label}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
