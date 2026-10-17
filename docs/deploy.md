# Deploy

## Docker

Draftly ships as one image (Node 26, Next.js standalone output) with SQLite on a named volume.

Local run:

```sh
ADMIN_PASSWORD='choose-a-password' docker compose up --build
# open http://localhost:3000/admin
```

Variables: `ADMIN_PASSWORD` (required), `DRAFTLY_PUBLIC_ORIGIN` (defaults to `http://localhost:3000`), `DRAFTLY_PORT` (host port, default 3000), `TRAEFIK_ENABLE` (set `false` locally). Put them in `.env` next to `docker-compose.yml`; `.env` is never copied into the image.

The SQLite database lives in `DRAFTLY_DATA_DIR` (`/data` in the image), on the `draftly-data` volume. `docker compose down` and container recreates keep comments; `docker compose down -v` deletes them.

On the VPS, the port is bound to `127.0.0.1` only, so Traefik is the public entry point for `draftly.mchlr.de` with TLS from the `letsencrypt` resolver. Reviewer comments are pushed over server-sent events. Traefik does not buffer SSE by default. Do not add a compress or buffering middleware to this router, and check that the SSE response is not gzip-buffered by Next, so comments still arrive within two seconds.

## VPS (draftly.mchlr.de)

Every push to `main` makes `.github/workflows/image.yml` build the image and push it to `ghcr.io/mchlrdev/draftly` with two tags: `latest` and the short commit SHA. The VPS never builds. It only pulls.

Traefik runs as `/docker/traefik` with `network_mode: host`, entrypoint `websecure` and resolver `letsencrypt`. It reaches the container on its bridge IP, so `deploy/docker-compose.yml` publishes no port.

First setup on the VPS:

```sh
mkdir -p /docker/draftly && cd /docker/draftly
# copy deploy/docker-compose.yml here as docker-compose.yml
echo "ADMIN_PASSWORD='choose-a-password'" > .env && chmod 600 .env
# the package is private: log in once with a classic PAT that has read:packages
echo "$GHCR_PAT" | docker login ghcr.io -u mchlrdev --password-stdin
docker compose pull && docker compose up -d
```

Update, once the Image workflow has finished:

```sh
cd /docker/draftly && docker compose pull && docker compose up -d && docker image prune -f
```

Roll back by pinning a SHA tag: put `DRAFTLY_TAG=<sha>` in `.env`, then run `docker compose up -d`.
