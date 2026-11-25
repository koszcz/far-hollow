# 03: Smoke fish on the drying rack

**What to build:** The player hangs raw fish on the drying rack next to a lit fire. After a while it becomes smoked fish, which never spoils. See `.scratch/food-keeping/spec.md`.

**Blocked by:** 02

**Status:** ready-for-agent

**Assets:** Add drafts built in code: raw fish hanging on the `drying-rack`, and an icon and ground pile for smoked fish. No approved asset changes. Settled with the owner on 2026-11-25.

## Smoking

- [ ] The player hangs raw fish on the drying rack like other food. It counts toward the rack's 6 foods.
- [ ] Raw fish smokes only while a lit campfire or fireplace is within 2 m of the rack. It takes 4 game hours of smoking.
- [ ] If the fire goes out or there is none, the fish keeps its progress. Smoking carries on when a fire is lit again.
- [ ] Raw fish on the rack keeps spoiling until it is smoked.
- [ ] The rack refuses cooked fish, with the reason that only raw fish can be smoked (ADR 0008).
- [ ] The rack panel shows when a fish is not smoking because no fire is lit close by.

## Smoked fish

- [ ] Smoked fish never spoils and has no freshness bar.
- [ ] It weighs the same as raw fish and fills the same hunger as cooked fish (0.3). It does not make the player sick.
- [ ] It can be stored in chests and shelves and dropped like other food.
- [ ] A finished smoked fish counts for the journal goal "Preserve some food for winter".

## The rest

- [ ] `GLOSSARY.md` defines Smoke and Smoked fish. This is done already.
- [ ] The new drafts are in `asset-manifest.json` with `"status": "draft"` and this ticket's path.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover smoking with a campfire and a fireplace in reach, no progress without a fire, kept progress, the 2 m limit, spoiling before smoking, the cooked fish refusal, eating smoked fish, and saving.
