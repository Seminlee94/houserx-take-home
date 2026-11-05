// Launch the e2e test stack manually for hands-on exploration.
//
// Starts the test backend (:9001) and test storefront (:8001) together, wired to
// the dedicated test database and its publishable key — the same servers
// Playwright boots, but kept alive so you can click around at the printed URL.
// Ctrl-C (or either process exiting) stops both.
//
// Run `pnpm run e2e:reset` first so the test DB and e2e/.env.e2e exist.

import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const storefrontDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const backendDir = path.resolve(storefrontDir, "../backend")
const envPath = path.join(storefrontDir, "e2e", ".env.e2e")

if (!existsSync(envPath)) {
  console.error("e2e/.env.e2e not found. Run `pnpm run e2e:reset` first.")
  process.exit(1)
}

const env = {}
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    continue
  }
  const eq = trimmed.indexOf("=")
  if (eq !== -1) {
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
}

function need(key) {
  if (!env[key]) {
    console.error(`${key} missing from e2e/.env.e2e; re-run \`pnpm run e2e:reset\`.`)
    process.exit(1)
  }
  return env[key]
}

const children = []
let shuttingDown = false

function shutdown() {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  for (const child of children) {
    try {
      child.kill("SIGINT")
    } catch {}
  }
  setTimeout(() => process.exit(0), 500)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

function launch(name, command, args, cwd, extraEnv) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...extraEnv } })

  const prefixLines = (stream) => {
    let buffer = ""
    stream.on("data", (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        console.log(`[${name}] ${line}`)
      }
    })
  }
  prefixLines(child.stdout)
  prefixLines(child.stderr)

  child.on("exit", (code) => {
    console.log(`[${name}] exited (${code}); stopping the test stack`)
    shutdown()
  })

  children.push(child)
}

launch("backend", "pnpm", ["exec", "medusa", "develop", "--no-lint"], backendDir, {
  DATABASE_URL: need("E2E_DATABASE_URL"),
  PORT: need("E2E_BACKEND_PORT"),
  STORE_CORS: need("E2E_STORE_CORS"),
})

launch(
  "storefront",
  "pnpm",
  ["exec", "next", "dev", "--turbopack", "-p", need("E2E_STOREFRONT_PORT")],
  storefrontDir,
  {
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: need("E2E_BACKEND_URL"),
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: need("E2E_PUBLISHABLE_KEY"),
    NEXT_PUBLIC_DEFAULT_REGION: "dk",
    NEXT_PUBLIC_BASE_URL: `http://localhost:${need("E2E_STOREFRONT_PORT")}`,
  }
)

console.log(
  `Test stack starting — backend :${env.E2E_BACKEND_PORT}, storefront :${env.E2E_STOREFRONT_PORT}`
)
console.log(
  `Open http://localhost:${env.E2E_STOREFRONT_PORT}/dk once it compiles. Ctrl-C stops both.`
)
