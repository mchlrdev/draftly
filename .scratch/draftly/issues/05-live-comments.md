# 05: A second client sees comments without reload

**What to build:** Two HTTP clients on the same draft. One posts a thread or comment; the other receives the full object on the event stream in under two seconds. Reconnect reloads the snapshot. No cursors, no presence.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] SSE (or equivalent stream) on the draft after password
- [ ] `thread.created`, `comment.created`, `comment.updated`, `comment.deleted`, `thread.updated`, `thread.deleted` each carry the full object
- [ ] Second client shows the new thread without a manual reload, under two seconds
- [ ] After disconnect, client reconnects and GETs a full snapshot
- [ ] No presence or cursor events exist
