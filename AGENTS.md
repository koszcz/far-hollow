# AGENTS.md

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

Implement one ticket per session. Land each finished ticket on `main` with `make land`, which merges, checks, pushes, and deletes the branch. Once it has landed, stop work and name the next unblocked ticket for the owner to start in a fresh session. The owner closes the tab.

`make land` names its merge commit after the branch's own commits. If you resolve a merge conflict by hand, name the merge the same way: `Land on main: <what the branch adds>`, never `Merge branch 'main' into <branch>`.

Idea sessions and grilling sessions also end with `make land`. Run it as soon as the files are written. Do not ask the owner first.

### Ticket statuses

There is no triage. An open ticket is either an `idea`, which needs grilling, or `ready-for-agent`, which a grilling session settled. Never ask the owner to triage. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Value objects

When code you write or touch repeats a calculation or a rule on a plain value, such as a facing, a ground spot, or a set of counts, make it a value object. See `docs/adr/0009-value-objects-are-plain-types-with-a-module-of-pure-functions.md`.

### Game testing

Before you play the game in a browser to test a change, a bug, or a QA task, read `docs/agents/game-testing.md`. It covers reading game state instead of taking screenshots. Pass this pointer to any QA subagent you start.

## Assets

Every asset (3D model, texture, animation, or sound) is listed in the asset catalogue, `asset-manifest.json`. When a ticket needs an asset:

1. Reuse the catalogue entry if one exists. Its `code` field names the files that build or draw it.
2. If none exists, build a draft asset in code, as cheaply as possible, and add it with `"status": "draft"` and the ticket's path. Exception: if the owner approved a third-party file in chat before the ticket started, add that file as a draft instead. Record the owner's approval in the entry's `fileApproval` field.
3. Change an approved asset or add a third-party file only with the owner's explicit approval in chat.

Unpacked third-party packs, such as Kenney kits, live in `third-party/` at the root of the main checkout. Git ignores this folder. Copy a file from it into `public/assets/<id>/` only with the owner's approval.

The owner polishes drafts with the `make-asset` skill. See `docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md`.
