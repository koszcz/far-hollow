# 02: Give material counts one module that owns their rules

**What to build:** Add a value object for "how many of each kind", in `src/sim/counts.ts`, following ADR 0009. Woodpiles, sleds, blueprints, chests, and the backpack use it to add, take, and total their contents. The game behaves exactly as before.

**Status:** resolved

**Assets:** None. This ticket changes no asset.

## Why

Five things in the game hold counts of materials, and each one handles them its own way:

| Holder | Type | Where it changes counts |
| --- | --- | --- |
| Woodpile | full `Record<WoodpileWood, number>` | `src/sim/woodpiles.ts:50`, `:120`, `:134` |
| Sled | full `SledLoad` record | `src/sim/sleds.ts:116`, `:236`, `:242`, `:264`, and `src/sim/building.ts:195` |
| Blueprint | partial `delivered` record | `src/sim/building.ts:296`, `:350`, `:421`, `:438` |
| Chest or shelf | partial `BackpackContents` | `src/sim/chests.ts:127` |
| Backpack | partial `BackpackContents` | `addToBackpack` and `removeFromBackpack` in `src/sim/backpack.ts` |

Some records list every kind. Others leave missing kinds out, so callers write `(counts[kind] ?? 0) + 1`. Totals are written separately too, such as `woodpileTotal` and `contentsWeight`. The rule that a count never drops below zero is checked in some places and not in others.

## What the module holds

Choose the exact names. The module works on partial records, so a missing kind counts as zero. It needs at least these functions:

- how many of one kind
- add some of one kind
- take some of one kind, never going below zero
- the total across all kinds
- whether it is empty

Each function returns a new record. The caller assigns it back to the component.

Weight limits and other rules that belong to one holder, such as how much fits in the backpack, stay in that holder's module. They call the counts module.

## Acceptance criteria

- [x] The five holders above add, take, and total their contents through the counts module.
- [x] No file in `src/sim` changes a material count with `?? 0`, `+=`, or `-=` outside the module.
- [x] Saved games keep the same shape. Old saves still load.
- [x] Unit tests cover each function, including taking more than there is.
- [x] `make check` passes.

## Comments

- A pile holds one kind and one number, `{ content, count }`, not a counts record. So `piles.ts` and the plank take in `building.ts` still change `pile.count` with `+=` and `-=`. The counts module works on records of several kinds, so it does not fit here.
