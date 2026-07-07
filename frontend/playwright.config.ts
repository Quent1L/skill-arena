import { defineConfig, devices } from '@playwright/test'

const E2E_DATABASE_URL = 'postgres://skolarena:skolarena@localhost:5435/skolarena_e2e'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // DB partagée + specs qui mutent l'état: exécution séquentielle
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    // Neutralise le service worker PWA (dev-dist) pendant les runs
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // useViewport teste screen.width/height < 768: l'écran headless
        // par défaut (1280x720) ferait basculer l'app en variante mobile
        screen: { width: 1920, height: 1080 },
        viewport: { width: 1280, height: 800 },
        storageState: 'e2e/.auth/player.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      // Le frontend dev appelle http://localhost:3000 en dur (ApiConfig):
      // le backend e2e DOIT posséder ce port — stoppe la stack dev avant.
      command: 'bun run src/index.ts',
      cwd: '../backend',
      url: 'http://localhost:3000/',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        BETTER_AUTH_SECRET: 'e2e-secret-at-least-32-characters!!',
        BETTER_AUTH_URL: 'http://localhost:3000',
        NODE_ENV: 'development',
        ENABLE_EMAIL_PASSWORD: 'true',
        LOG_LEVEL: 'warn',
        // Neutralise le SSO Keycloak que backend/.env pourrait activer
        // (dotenv n'écrase pas les variables déjà présentes)
        KEYCLOAK_CLIENT_ID: '',
        KEYCLOAK_CLIENT_SECRET: '',
        KEYCLOAK_ISSUER: '',
        KEYCLOAK_DISCOVERY_URL: '',
      },
    },
    {
      // Binaire direct: `bun x` peut bloquer quand le backend est spawné en parallèle
      command: './node_modules/.bin/vite --mode dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_E2E: '1',
      },
    },
  ],
})
