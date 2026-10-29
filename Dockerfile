# syntax=docker/dockerfile:1

# Draftly needs Node 26 for the builtin `node:sqlite` module.
# Pinned to the major; the Debian slim image has no native build deps to install.
ARG NODE_VERSION=26

# 1. Dependencies (full install, incl. dev deps for the build)
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build the Next.js app (standalone output)
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Runtime: standalone server only, non-root, SQLite on /data
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DRAFTLY_DATA_DIR=/data \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Headless Chromium shell plus its system libraries, for agent screenshots
# (lib/server/screenshot.ts). Installed by the playwright-core version the
# app runs with, so browser and library always match.
COPY --from=deps /app/node_modules/playwright-core /tmp/playwright-core
RUN node /tmp/playwright-core/cli.js install --with-deps chromium-headless-shell \
 && rm -rf /tmp/playwright-core /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 draftly \
 && useradd --system --uid 1001 --gid draftly --home-dir /app --shell /usr/sbin/nologin draftly \
 && mkdir -p /data \
 && chown draftly:draftly /data

# Standalone bundle: server.js plus traced node_modules.
COPY --from=build /app/.next/standalone ./
# playwright-core loads parts lazily that file tracing can miss: ship it whole.
COPY --from=deps /app/node_modules/playwright-core ./node_modules/playwright-core
# Static assets and public files are not part of the standalone bundle.
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Database lives on a volume (see docker-compose.yml), never in the image.
VOLUME ["/data"]

USER draftly
EXPOSE 3000

CMD ["node", "server.js"]
