import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Eigene Config für die Echt-Modell-Eval (v0.4.5, ADR-0018). Getrennt vom keyless Unit-CI
// (vitest.config.ts, test/**/*.test.ts): hier laufen NUR die *.eval.ts gegen ein echtes Modell —
// langlebige Timeouts, kein Coverage. Aufruf: `npm run eval` mit BLITZTEXT_EVAL_API_KEY.
export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['eval/**/*.eval.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000
  }
})
