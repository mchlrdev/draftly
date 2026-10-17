import { spawn, type ChildProcess } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { TestProject } from "vitest/node"

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on("error", reject)
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address()
      const port = typeof address === "object" && address ? address.port : 0
      srv.close(() => resolve(port))
    })
  })
}

async function waitFor(url: string, child: ChildProcess, timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null)
      throw new Error(`next dev exited with ${child.exitCode}`)
    try {
      const res = await fetch(url)
      await res.arrayBuffer()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  throw new Error(`next dev did not answer at ${url} within ${timeoutMs} ms`)
}

let child: ChildProcess | undefined
let dataDir: string | undefined

export async function setup(project: TestProject) {
  const port = await freePort()
  dataDir = mkdtempSync(join(tmpdir(), "draftly-test-"))
  const root = join(import.meta.dirname, "..")
  child = spawn(
    join(root, "node_modules/.bin/next"),
    ["dev", "--port", String(port), "--hostname", "127.0.0.1"],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_DIST_DIR: ".next-test",
        DRAFTLY_DATA_DIR: dataDir,
        ADMIN_PASSWORD: "test-secret",
        // Every test client sends its own x-forwarded-for, so per-IP limits stay
        // deterministic: the 429 tests just exceed these from one client.
        DRAFTLY_RATE_LOGIN: "10",
        DRAFTLY_RATE_WRITE: "30",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    }
  )
  let log = ""
  child.stdout?.on("data", (d) => (log += d))
  child.stderr?.on("data", (d) => (log += d))
  const baseUrl = `http://127.0.0.1:${port}`
  try {
    await waitFor(`${baseUrl}/api/admin/session`, child, 90_000)
  } catch (err) {
    console.error(log)
    throw err
  }
  if (process.env.DRAFTLY_TEST_LOG) child.stdout?.pipe(process.stdout)
  project.provide("baseUrl", baseUrl)
}

export async function teardown() {
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM")
    } catch {
      // already gone
    }
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true })
}
