# 01: Operator can sign in at /admin

**What to build:** The operator opens `/admin`, enters the environment password, and gets a session cookie. Wrong password fails. Signed-in, they see the empty admin shell. Signed-out, `/admin` is only the login.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `/admin` shows a login (German), not the project list
- [ ] Correct password sets an HTTP-only session cookie and shows the admin shell
- [ ] Wrong password does not create a session
- [ ] Subsequent `/admin` requests with the cookie skip the login
- [ ] `/admin` and `/api` are reserved path prefixes
