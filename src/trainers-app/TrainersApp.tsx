import { useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import { buildTrainersRoutes } from './routes'

/**
 * Root of the trainers page. Hash router: the server only has to serve the
 * page itself, inner screens live after the `#` (`/trainers-app/#/english`).
 */
export function TrainersApp() {
  const [router] = useState(() => createHashRouter(buildTrainersRoutes()))
  return <RouterProvider router={router} />
}
