# Draftly

A self-hosted HTML review tool: an operator shares a draft of uploaded pages; a reviewer comments on them without an account.

## People

**Operator**:
The one person who runs Draftly, creates projects and drafts, and uploads pages.
_Avoid_: Admin (the role is operator; `/admin` is just the URL), Designer, Maintainer

**Reviewer**:
Someone who opens a draft link, enters the draft password, and comments. No account.
_Avoid_: Client, Customer, Guest, Kundin, User

## Things

**Project**:
An operator-only folder that groups drafts. It has a slug but no public index: a URL with only the project segment is 404.
_Avoid_: Site, Workspace, Folder

**Draft**:
The shareable unit: a public URL of `/<project-slug>/<draft-slug>`, its own generated password, and a letterbox colour. Contains one or more pages.
_Avoid_: Showcase, Review, Share, Prototype, Version

**Page**:
One self-contained HTML file inside a draft. Reviewers switch between pages; pins belong to a page, not to the draft as a whole.
_Avoid_: Artboard, Screen, Frame, File

**Thread**:
A pin on a page plus its comments. It is `open` or `resolved`.
_Avoid_: Annotation, Note, Marker

**Pin**:
The visual marker for a thread, placed in the page's design coordinates (not viewport pixels).
_Avoid_: Marker, Dot, Hotspot

**Comment**:
One message in a thread, with a display name, body, and a `clientId` so a reviewer can edit or delete their own.
_Avoid_: Note, Message, Reply (a reply is still a comment)

## Display

**Letterbox**:
The empty bands around a fixed-width page when the viewer is wider than the design. Colour is set per draft.
_Avoid_: Margin, Padding, Backdrop (too generic)

**Fixed display**:
The page is shown at its design width, never scaled up. If the viewer is narrower, it scales down uniformly to fit width.
_Avoid_: Responsive, Fluid

**Fill display**:
The iframe is as wide as the viewer chrome. The HTML inside may be full-width. A fixed Paper layout is not scaled up to fill.
_Avoid_: 100%, Responsive, Fluid, Stretch
