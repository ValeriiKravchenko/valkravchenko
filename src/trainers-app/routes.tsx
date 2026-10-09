import type { RouteObject } from 'react-router'
import { TrainersIndexPage } from './pages/TrainersIndexPage'
import { EnglishPage } from './pages/EnglishPage'
import { GitBasicsPage } from './pages/GitBasicsPage'
import { GitBranchingPage } from './pages/GitBranchingPage'
import { GitCollaboratingPage } from './pages/GitCollaboratingPage'
import { GitInspectingPage } from './pages/GitInspectingPage'
import { GitSearchingPage } from './pages/GitSearchingPage'
import { GitUndoingPage } from './pages/GitUndoingPage'
import { TrainersNotFoundPage } from './pages/TrainersNotFoundPage'
import { TRAINER_PATHS } from './paths'
import { TrainersLayout } from './TrainersLayout'

/** Route tree of the trainers page: the list, six Git sections, English, and a 404. */
export function buildTrainersRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      element: <TrainersLayout />,
      children: [
        { index: true, element: <TrainersIndexPage /> },
        { path: TRAINER_PATHS.git.slice(1), element: <GitBasicsPage /> },
        { path: TRAINER_PATHS.branching.slice(1), element: <GitBranchingPage /> },
        { path: TRAINER_PATHS.inspecting.slice(1), element: <GitInspectingPage /> },
        { path: TRAINER_PATHS.undoing.slice(1), element: <GitUndoingPage /> },
        { path: TRAINER_PATHS.collaborating.slice(1), element: <GitCollaboratingPage /> },
        { path: TRAINER_PATHS.searching.slice(1), element: <GitSearchingPage /> },
        { path: TRAINER_PATHS.english.slice(1), element: <EnglishPage /> },
        { path: '*', element: <TrainersNotFoundPage /> },
      ],
    },
  ]
}
