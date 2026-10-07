import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { buildRoutes } from '../routes'

/** Renders the full app route tree at `path`, optionally with another registry. */
export function renderAt(path: string, routes = buildRoutes()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return { router, ...render(<RouterProvider router={router} />) }
}
