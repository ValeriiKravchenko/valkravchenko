import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Two HTML pages: the site and the separate trainers page (`/trainers-app/`).
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        trainersApp: fileURLToPath(new URL('./trainers-app/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    clearMocks: true,
  },
})
