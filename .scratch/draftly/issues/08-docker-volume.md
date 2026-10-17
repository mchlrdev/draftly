# 08: Docker stack with its own SQLite volume

**What to build:** Draftly runs in Docker Compose locally with SQLite on a named volume. A restart keeps comments. This is the same image shape that will sit behind Traefik.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `docker compose up` serves the app
- [ ] SQLite lives on a volume, not in the image
- [ ] Comments survive a container recreate
- [ ] Compose is ready for Traefik labels (even if unused locally)
