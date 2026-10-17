# 03: Operator uploads a page; reviewer sees it behind the password

**What to build:** The operator uploads a self-contained HTML page (fixed or fill, design width). HTML with `http:`/`https:` URLs is rejected. A reviewer with the draft password sees the page in a sandboxed iframe. Without the password they see the gate, not the HTML. Implement to the Paper artboards Passwort and Viewer.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Self-contained HTML uploads and is stored on the draft
- [ ] HTML containing `http:` or `https:` is rejected
- [ ] Reviewer with the correct password sees the page in a sandboxed iframe (no scripts)
- [ ] Reviewer without the password does not see HTML or comments
- [ ] Operator session skips the password gate on the same draft URL
- [ ] Responses send `X-Robots-Tag: noindex`
- [ ] Viewer matches the Paper file Draftly, artboard Viewer (translucent chrome, letterbox, page switcher)
