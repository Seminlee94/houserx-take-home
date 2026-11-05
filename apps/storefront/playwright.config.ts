import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import { E2E } from "./e2e/load-env"

// The e2e stack is dedicated and runs alongside your dev stack:
//   dev:  storefront :8000  ->  backend :9000  ->  medusa-dtc-starter
//   e2e:  storefront :8001  ->  backend :9001  ->  medusa-dtc-starter-test
//
// `e2e:reset` prepares the test database and writes e2e/.env.e2e; this config
// only boots (or reuses) the two servers against that already-prepared database
// and does no database work itself.

const backendDir = path.resolve(__dirname, "../backend")

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: E2E.baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Test backend on its own port and database. Inline env overrides win
      // over apps/backend/.env (loadEnv does not clobber already-set vars), so
      // the rest of the backend config (secrets, admin/auth CORS) is reused.
      command: "pnpm exec medusa develop --no-lint",
      cwd: backendDir,
      url: `${E2E.backendUrl}/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DATABASE_URL: E2E.databaseUrl,
        PORT: E2E.backendPort,
        STORE_CORS: E2E.storeCors,
      },
    },
    {
      command: `pnpm exec next dev --turbopack -p ${E2E.storefrontPort}`,
      cwd: __dirname,
      url: E2E.baseURL,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_MEDUSA_BACKEND_URL: E2E.backendUrl,
        NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: E2E.publishableKey,
        NEXT_PUBLIC_DEFAULT_REGION: "dk",
        NEXT_PUBLIC_BASE_URL: E2E.baseURL,
      },
    },
  ],
})
