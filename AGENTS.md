# AGENTS.md

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels, recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Assets

Never add a 3D model, texture, animation, or sound without the owner's explicit approval in chat. For each asset, propose either a specific CC0 file (with source and license) or building it in code, then wait for the owner to choose. See `docs/adr/0004-every-asset-needs-owner-approval.md`.
