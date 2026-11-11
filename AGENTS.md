# AGENTS.md

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

Implement one ticket per session. Once a ticket is merged and pushed, end the session and name the next unblocked ticket for the owner to start in a fresh session.

### Triage labels

Uses the five default triage labels, recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Assets

Every asset (3D model, texture, animation, or sound) is listed in the asset catalogue, `asset-manifest.json`. When a ticket needs an asset:

1. Reuse the catalogue entry if one exists. Its `code` field names the files that build or draw it.
2. If none exists, build a draft asset in code, as cheaply as possible, and add it with `"status": "draft"` and the ticket's path. Exception: if the owner approved a third-party file in chat before the ticket started, add that file as a draft instead. Record the owner's approval in the entry's `fileApproval` field.
3. Change an approved asset or add a third-party file only with the owner's explicit approval in chat.

Unpacked third-party packs, such as Kenney kits, live in `third-party/` at the root of the main checkout. Git ignores this folder. Copy a file from it into `public/assets/<id>/` only with the owner's approval.

The owner polishes drafts with the `make-asset` skill. See `docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md`.
