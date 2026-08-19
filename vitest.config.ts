import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Renderer components are authored without importing React, so the test
  // transform has to use the automatic JSX runtime the app build uses.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx']
  }
})
