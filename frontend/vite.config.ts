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
  optimizeDeps: {
    // Scanne aussi les vues lazy du router: sinon vite découvre leurs
    // dépendances à la première navigation et déclenche un full reload
    // ("optimized dependencies changed") qui casse la navigation en cours.
    entries: ['index.html', 'src/views/**/*.vue'],
  },
})
