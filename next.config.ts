import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Docker image ships the standalone server (Dockerfile).
  output: "standalone",
  // Tests and parallel dev servers each get their own build dir, since a
  // `next dev` holds a lock on its distDir.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
}

export default nextConfig
