import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      setupFiles: ['./vitest.setup.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx,vue}'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/__tests__/**',
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/*.d.ts',
          '**/types/**',
          '**/config/**',
          'src/test-support/**',
          'src/sw.ts',
          'src/main.ts',
        ],
        reportsDirectory: './coverage',
        reporter: ['text', 'html', 'json', 'lcov'],
        // Plancher-cliquet: la couverture globale inclut tout src/ (vues comprises).
        // Remonter ces seuils au fil des nouveaux tests.
        lines: 9,
        functions: 7,
        branches: 6,
        statements: 9,
      },
    },
  }),
)
