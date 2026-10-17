# SQLite in Draftly's own volume

Draftly stores projects, drafts, pages, threads, and comments in SQLite on a Docker volume attached to its own compose stack. The VPS already runs Postgres for Convex. Sharing that instance would couple backups, upgrades, and outages. Shared-hosting MySQL was the original hosting constraint and does not apply on this VPS.
