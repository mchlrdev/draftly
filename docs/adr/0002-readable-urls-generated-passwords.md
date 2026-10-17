# Readable slugs plus a generated password per draft

A draft is reached at `/<project-slug>/<draft-slug>`, both chosen by the operator. Access is a generated password stored as a hash, shown in plaintext once, then only rotatable. Unguessable tokens in the URL were rejected because the operator needs a link they can say out loud. One password for a whole project was rejected because readable slugs are guessable and would leak a later draft. Accounts were rejected for reviewers. The operator authenticates separately at `/admin` with a session cookie and then skips draft passwords. `/<project-slug>` without a draft is 404; it is not a listing and not a redirect.

## Amendment (2026-10-17): the operator can see the password again

"Shown once, then only rotatable" was too strict in practice: the operator re-sends the same password to a reviewer and rotating just to read it breaks the link for everyone. The password is now also stored encrypted (AES-256-GCM, key derived from the server secret in the database) next to its hash, and the signed-in operator can reveal and copy it at any time. Reviewer access is still checked against the hash. Rotation stays for leaked passwords. Drafts created before this change have no encrypted copy; the operator rotates once to get one.
