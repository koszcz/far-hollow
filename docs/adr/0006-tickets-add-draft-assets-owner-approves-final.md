---
status: accepted
---

# Tickets add draft assets, and the owner approves final assets

This replaces ADR 0004. Every asset is listed in the asset catalogue, `asset-manifest.json`. A gameplay ticket first reuses an asset from the catalogue. If the asset it needs is missing, the ticket builds a rough draft asset in code and lists it as a draft, without waiting for the owner. Draft assets are kept as cheap as possible: simple shapes, flat colours, and code tweens, with sounds synthesized in code or left out. The owner later polishes each draft in its own session with the `make-asset` skill and is the only person who can approve an asset. We chose this because waiting for the owner on every asset blocked gameplay work, while the owner still controls the final look.

## Rules

- A draft asset is always built in code. A third-party file always needs the owner's approval before it enters the game, so every license stays known.
- A ticket may change a draft asset. Changing an approved asset needs the owner's approval first.
- The build passes while draft assets exist. `make drafts` lists them.

## Considered options

- **Owner approves every asset before use (ADR 0004)**: rejected. It blocked every ticket that needed a new asset.
- **Tickets may also add third-party files as drafts**: rejected. Files with unknown licenses could enter the game unnoticed.
- **One issue per draft asset**: rejected. The catalogue already records every draft, so a second list would drift out of date.
