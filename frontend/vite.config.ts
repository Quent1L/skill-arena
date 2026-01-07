import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
    Components({
      resolvers: [PrimeVueResolver()],
    }),
    vueDevTools({ launchEditor: 'antigravity' }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Skill Arena',
        short_name: 'Skill Arena',
        description: 'La chance ne fait pas tout !',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/skill-arena-logo.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
      {
        find: /^brackets-viewer$/,
        replacement: fileURLToPath(
          new URL(
            './node_modules/brackets-viewer/dist/brackets-viewer.min.js',
            import.meta.url,
          ),
        ),
      },
      {
        find: 'brackets-viewer-css',
        replacement: fileURLToPath(
          new URL(
            './node_modules/brackets-viewer/dist/brackets-viewer.min.css',
            import.meta.url,
          ),
        ),
      },
    ],
  },
})
