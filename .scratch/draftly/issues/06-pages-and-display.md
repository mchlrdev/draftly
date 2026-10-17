# 06: Several pages, fixed scale, fill, letterbox

**What to build:** A draft can hold several pages. The reviewer switches pages; pins stay on their page. Fixed pages never scale above design width, scale down uniformly when narrower, and letterbox in the draft colour when wider. Fill pages use viewer width and do not upscale a fixed layout.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Operator can upload multiple pages and reorder them
- [ ] Reviewer can switch pages; threads are per page
- [ ] Fixed: no scale > 1; scale down to fit width; letterbox colour from the draft
- [ ] Fill: iframe matches viewer width; no upscale of a 1440 layout
- [ ] Pin coordinates still match the design after scale
