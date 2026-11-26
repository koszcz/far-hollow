# 03: Smoke fish on the drying rack

**What to build:** The player hangs raw fish on the drying rack next to a lit fire. After a while it becomes smoked fish, which never spoils. See `.scratch/food-keeping/spec.md`.

**Blocked by:** 02

**Status:** resolved

**Assets:** Add drafts built in code: raw fish hanging on the `drying-rack`, and an icon and ground pile for smoked fish. No approved asset changes. Settled with the owner on 2026-11-25.

## Smoking

- [x] The player hangs raw fish on the drying rack like other food. It counts toward the rack's 6 foods.
- [x] Raw fish smokes only while a lit campfire or fireplace is within 2 m of the rack. It takes 4 game hours of smoking.
- [x] If the fire goes out or there is none, the fish keeps its progress. Smoking carries on when a fire is lit again.
- [x] Raw fish on the rack keeps spoiling until it is smoked.
- [x] The rack refuses cooked fish, with the reason that only raw fish can be smoked (ADR 0008).
- [x] The rack panel shows when a fish is not smoking because no fire is lit close by.

## Smoked fish

- [x] Smoked fish never spoils and has no freshness bar.
- [x] It weighs the same as raw fish and fills the same hunger as cooked fish (0.3). It does not make the player sick.
- [x] It can be stored in chests and shelves and dropped like other food.
- [x] A finished smoked fish counts for the journal goal "Preserve some food for winter".

## The rest

- [x] `GLOSSARY.md` defines Smoke and Smoked fish. This is done already.
- [x] The new drafts are in `asset-manifest.json` with `"status": "draft"` and this ticket's path.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover smoking with a campfire and a fireplace in reach, no progress without a fire, kept progress, the 2 m limit, spoiling before smoking, the cooked fish refusal, eating smoked fish, and saving.

## Comments

- 2026-11-26, implementation: the action menu offers "Hang raw fish" while the backpack holds raw fish. It offers "Hang cooked fish", greyed with the reason, only while the backpack holds cooked fish and no raw fish. This keeps an action that never works out of the menu most of the time.
- The 2 m is measured from the middle of the rack to the middle of the campfire or fireplace. A fire that goes out during a game step stops the smoking for that whole step, as with fish cooking on a fire.
- The rack panel says "Smoking" or "Smoked" for fish, and "No fire" while raw fish waits for a lit fire close by. Longer wording wrapped beside the bar.
- How far each food on a rack has come is now saved as `minutesPreserved`, not `minutesDried`, since it counts smoking too. The save version goes up to 65, and the upgrade renames the field in older saves.
- The new drafts are `smoked-fish-icon` and `smoked-fish-pile`. The `drying-rack` draft now hangs raw fish by its tail, head down, at true size, and shows it smoked once it is done.
