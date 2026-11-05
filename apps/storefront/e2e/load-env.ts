// Loads the e2e stack config written by scripts/e2e-reset.mjs.
//
// Imported by both playwright.config.ts (main process) and fixtures.ts (worker
// processes), so every process gets the same values without relying on env
// inheritance. Fails loudly if the reset has never been run.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const envPath = path.join(__dirname, ".env.e2e")

if (!existsSync(envPath)) {
  throw new Error(
    "e2e/.env.e2e not found. Run `pnpm run e2e:reset` first to create and seed the test database."
  )
}

const parsed: Record<string, string> = {}
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    continue
  }
  const eq = trimmed.indexOf("=")
  if (eq === -1) {
    continue
  }
  parsed[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
}

function required(key: string): string {
  const value = parsed[key]
  if (!value) {
    throw new Error(`${key} missing from e2e/.env.e2e. Re-run \`pnpm run e2e:reset\`.`)
  }
  return value
}

export const E2E = {
  databaseUrl: required("E2E_DATABASE_URL"),
  backendUrl: required("E2E_BACKEND_URL"),
  backendPort: required("E2E_BACKEND_PORT"),
  storefrontPort: required("E2E_STOREFRONT_PORT"),
  storeCors: required("E2E_STORE_CORS"),
  publishableKey: required("E2E_PUBLISHABLE_KEY"),
  get baseURL() {
    return `http://localhost:${this.storefrontPort}`
  },
}
