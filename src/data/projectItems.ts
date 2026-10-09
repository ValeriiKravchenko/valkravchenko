import type { ProjectItem } from '../components/ProjectList'
import type { Dictionary } from '../i18n/types'
import type { Project } from './projects'

/** Joins project data with dictionary texts into what ProjectList renders. */
export function buildProjectItems(projects: readonly Project[], t: Dictionary): ProjectItem[] {
  return projects.map((project) => {
    const text = t.projects.texts[project.id]
    return {
      id: project.id,
      title: text.title,
      description: text.description,
      tags: project.tags.map((tag) => t.projects.tags[tag]),
      tagsLabel: t.projects.tagsLabel,
      link: project.path
        ? {
            href: project.path,
            internal: true,
            fullLoad: project.fullLoad,
            label: t.projects.pathLinkLabel,
            ariaLabel: `${t.projects.pathLinkLabel}: ${text.title}`,
          }
        : {
            href: project.url ?? '',
            label: t.projects.linkLabel,
            ariaLabel: `${t.projects.linkLabel}: ${text.title} ${t.projects.newTabNote}`,
          },
    }
  })
}
