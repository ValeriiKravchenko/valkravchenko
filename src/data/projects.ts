import { TRAINERS_APP_PATH } from './trainerPaths'

export const PROJECT_IDS = [
  'studynotes',
  'bank-statement-automation',
  'payment-registry-automation',
  'valkravchenko',
  'git-trainer',
] as const

export type ProjectId = (typeof PROJECT_IDS)[number]

export type ProjectDirection = 'java' | 'automation' | 'web'

export const TAG_IDS = [
  'java',
  'spring-boot',
  'spring-security',
  'postgresql',
  'flyway',
  'openapi',
  'testcontainers',
  'github-actions',
  'excel',
  'power-query',
  'python',
  'react',
  'typescript',
  'tailwind',
  'vite',
  'vitest',
] as const

export type TagId = (typeof TAG_IDS)[number]

export interface Project {
  id: ProjectId
  direction: ProjectDirection
  /** Repository URL. Set for projects that live in a repository. */
  url?: string
  /** In-site path. Set for projects shown on the site itself; used instead of `url`. */
  path?: string
  /** The path is a separate page served by the server: open it with a full page load. */
  fullLoad?: boolean
  /** Stack tags; labels live in the dictionary. */
  tags: readonly TagId[]
}

export const PROJECTS: readonly Project[] = [
  {
    id: 'studynotes',
    direction: 'java',
    url: 'https://github.com/ValeriiKravchenko/studynotes',
    tags: [
      'java',
      'spring-boot',
      'spring-security',
      'postgresql',
      'flyway',
      'openapi',
      'testcontainers',
      'github-actions',
    ],
  },
  {
    id: 'bank-statement-automation',
    direction: 'automation',
    url: 'https://github.com/ValeriiKravchenko/bank-statement-automation',
    tags: ['excel', 'power-query'],
  },
  {
    id: 'payment-registry-automation',
    direction: 'automation',
    url: 'https://github.com/ValeriiKravchenko/payment-registry-automation',
    tags: ['excel', 'power-query', 'python'],
  },
  {
    id: 'valkravchenko',
    direction: 'web',
    url: 'https://github.com/ValeriiKravchenko/valkravchenko',
    tags: ['react', 'typescript', 'tailwind', 'vite', 'vitest', 'github-actions'],
  },
  {
    id: 'git-trainer',
    direction: 'web',
    // Opens the separate trainers page.
    path: TRAINERS_APP_PATH,
    fullLoad: true,
    tags: ['react', 'typescript', 'vitest'],
  },
]

export function getProjectsByDirection(
  direction: ProjectDirection,
  projects: readonly Project[] = PROJECTS,
): Project[] {
  return projects.filter((project) => project.direction === direction)
}
