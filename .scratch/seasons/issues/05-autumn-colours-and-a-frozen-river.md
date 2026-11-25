# 05: Autumn colours and a frozen river

**What to build:** In autumn, the broadleaf trees turn amber, so the player sees winter coming. In winter, the river looks frozen: pale and still.

**Blocked by:** 03 (nature rests in winter)

**Status:** ready-for-agent

**Assets:** Add the drafts `autumn-trees` (an amber colour shift on broadleaf crowns, near and far, in code) and `frozen-river` (a pale, still water material, in code). Reuse `trees`, `far-trees`, and `river`. Settled with the owner on 2026-11-25.

## Autumn colours

- [ ] In autumn, broadleaf tree crowns, near and far, shift to amber. Conifers keep their colour.
- [ ] The shift eases in over the first days of autumn. It stays through winter under the snow and returns to green over spring day 1 and 2.

## A frozen river

- [ ] In winter, the river is drawn pale and still, with no flowing ripples.
- [ ] It returns to flowing water on day 1 of spring.

## The rest

- [ ] Both drafts are in the asset catalogue with `"status": "draft"` and this ticket's path (ADR 0006).
- [ ] Check the look in the browser with `?playground&season=autumn` and `?playground&season=winter`, following `docs/agents/game-testing.md`.
