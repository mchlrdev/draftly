# 04: Reviewer pins a comment on the page

**What to build:** The reviewer clicks the overlay and leaves a thread at design coordinates, under the display name they entered at the password gate. Threads persist, appear in the sidebar, and stay put after reload. Own comments can be edited or deleted via `clientId`; others cannot.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Clicking the overlay creates a thread at design x/y, not viewport pixels
- [ ] The password gate asks for display name and password together; the name is remembered in the browser and prefilled next time
- [ ] The comment composer does not ask for a name; new comments carry the gate name
- [ ] Snapshot after reload returns the same x/y and body
- [ ] Reviewer can reply in a thread
- [ ] Reviewer can edit or delete a comment with the same `clientId`
- [ ] Reviewer cannot edit or delete another `clientId`'s comment
- [ ] Sidebar lists threads for the current page; open/resolved filter
- [ ] Comment body is stored and rendered as text (no HTML injection)
- [ ] POST comment/password is rate-limited per IP
