# 02: Operator creates a project and a draft

**What to build:** Signed-in, the operator creates a project (chosen slug) and a draft under it (chosen slug). Draftly generates a password, shows it once, and never again. The public URL is `/<project-slug>/<draft-slug>`. A request to `/<project-slug>` is 404.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Operator can create a project with a slug they choose
- [ ] Operator can create a draft under that project with a slug they choose
- [ ] Duplicate slugs in the same project are rejected
- [ ] Slugs `admin` and `api` are rejected as the project segment
- [ ] A generated password is shown once; the store keeps only a hash
- [ ] Password can be rotated; the old one stops working
- [ ] `GET /<project-slug>` is 404
- [ ] Letterbox colour can be set on the draft
