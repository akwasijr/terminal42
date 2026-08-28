// Prepares what scripts/deckExportSmoke.cjs needs: the sample deck as a real
// file, and deckCapture as something a CommonJS Electron script can require.
// Both go to the temp directory — they are inputs to a check, not artefacts.

import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { samplePage } from '../tests/fixtures/deckSample'

writeFileSync(join(tmpdir(), 't42-deck-smoke.html'), samplePage('dark'))

await build({
  entryPoints: ['src/main/deckCapture.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: join(tmpdir(), 't42-deckCapture.cjs'),
  logLevel: 'warning'
})
