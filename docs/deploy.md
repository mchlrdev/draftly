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
