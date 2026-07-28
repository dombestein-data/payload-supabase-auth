import { defineConfig } from 'vitest/config'
import { config as loadEnv } from 'dotenv'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'

loadEnv({
  path: fileURLToPath(new URL('.env', import.meta.url)),
  quiet: true,
})
loadEnv({
  override: true,
  path: fileURLToPath(new URL('.env.test.local', import.meta.url)),
  quiet: true,
})

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
