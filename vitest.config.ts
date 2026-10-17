import { defineConfig } from "vitest/config"

// Tests talk to a real `next dev` over HTTP (spec "Testing Decisions").
// tests/global-setup.ts starts it on a free port with its own distDir and data dir.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // One server, shared state: run files one after another.
    fileParallelism: false,
    // First request to a route compiles it in dev.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
