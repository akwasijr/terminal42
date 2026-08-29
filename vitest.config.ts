import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Renderer components are authored without importing React, so the test
  // transform has to use the automatic JSX runtime the app build uses.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    // Most tests are pure logic and want no DOM. The ones that render a
    // component say so at the top of the file with
    //   // @vitest-environment jsdom
    // which keeps the fast path fast and still lets a component be looked at
    // rather than assumed.
    environmentMatchGlobs: [['tests/unit/**/*.dom.test.tsx', 'jsdom']]
  }
})
