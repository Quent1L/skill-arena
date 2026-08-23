import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import pagefind from 'astro-pagefind'

export default defineConfig({
  site: 'https://skol-arena-docs.vercel.app',
  integrations: [pagefind()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        // Same rationale as frontend/vite.config.ts: the watcher only skips
        // node_modules and .git by default, so it walks generated artifacts and
        // burns inotify watches until the dev server dies with ENOSPC.
        // dist/ is still *served* (Pagefind reads its index from there) — only
        // change detection is dropped.
        ignored: ['**/coverage/**', '**/dist/**', '**/.astro/**', '**/.code-review-graph/**'],
      },
    },
  },
})
