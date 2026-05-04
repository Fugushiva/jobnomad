import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'e2e/**'],
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
