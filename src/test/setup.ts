import '@testing-library/jest-dom/vitest'

// jsdom does not implement scrolling. Skipped in files that run under the node environment.
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
}
