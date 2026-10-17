# 09: draftly.mchlr.de on the VPS

**What to build:** Traefik on the existing VPS routes `draftly.mchlr.de` to the Draftly service with HTTPS. DNS A/AAAA for `draftly` on `mchlr.de` → VPS. Human does DNS if the agent cannot.

**Blocked by:** 08

**Status:** ready-for-human

- [ ] DNS `draftly.mchlr.de` → VPS `76.13.157.71`
- [ ] Traefik issues a certificate
- [ ] `https://draftly.mchlr.de/admin` shows the login
- [ ] SQLite volume persists on the VPS
