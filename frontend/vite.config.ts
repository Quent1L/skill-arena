import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import { readFileSync } from 'node:fs'
const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf-8').trim()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    {
      // Exposes the current version over HTTP: the client compares it against
      // __APP_VERSION__ to detect a deployment without waiting on the service
      // worker lifecycle. Emitted at build time rather than kept in public/ so it
      // cannot drift from ../VERSION.
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version }),
        })
      },
    },
    tailwindcss(),
    vue(),
    Components({
      resolvers: [PrimeVueResolver()],
    }),
    vueDevTools({ launchEditor: 'webstorm' }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        // Disabled during e2e runs: the dev service worker caches bundles and
        // interferes with Playwright.
        enabled: !process.env.VITE_E2E,
        type: 'module',
      },
      manifest: {
        name: 'Skol Arena',
        short_name: 'Skol',
        description: 'Skill Or Luck ?',
        theme_color: '#a78bfa',
        background_color: '#1e293b',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      // The watcher only skips node_modules and .git by default, so it walks
      // generated artifacts too. Coverage reports alone are hundreds of HTML
      // files, and watching them makes Bun's fs.watch throw EINVAL, which kills
      // the dev server. None of these are ever served in dev.
      // shared/dist is deliberately NOT ignored: it is what @skol-arena/shared
      // resolves to, and watching it is what reloads the app after a shared rebuild.
      ignored: [
        '**/coverage/**',
        '**/playwright-report/**',
        '**/test-results/**',
        '**/dev-dist/**',
        '**/.code-review-graph/**',
      ],
    },
  },
  optimizeDeps: {
    // Also scans the router's lazy views: otherwise vite discovers their
    // dependencies on first navigation and triggers a full reload
    // ("optimized dependencies changed") that breaks the ongoing navigation.
    entries: ['index.html', 'src/views/**/*.vue'],
  },
})
