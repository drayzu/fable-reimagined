import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
