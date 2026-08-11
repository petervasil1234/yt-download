import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_PORT = process.env.PORT ?? '5175'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    // In development Vite serves the UI and forwards /api to the Node process next to it.
    proxy: {
      '/api': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
})
