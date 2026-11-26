# 02: A drying rack dries berries and mushrooms

**What to build:** The player builds a drying rack and hangs berries and mushrooms on it. After a while they become dried berries and dried mushrooms, which never spoil. The journal suggests preserving food for winter. See `.scratch/food-keeping/spec.md`. Ticket 03 adds smoking fish on the same rack.

**Blocked by:** 01

**Status:** resolved

**Assets:** Add drafts built in code: `drying-rack` (the rack, with food hanging on it), and icons and ground piles for dried berries and dried mushrooms. Reuse `hud` for the rack panel. No approved asset changes. Settled with the owner on 2026-11-25.

## The rack

- [x] The drying rack is furniture in the build menu, built from 6 sticks and 2 cord through construction. It stands indoors or outdoors.
- [x] The player hangs one berries or one mushroom from the backpack on the rack at a time. The rack holds up to 6 foods in any mix. A full rack refuses more, with a reason (ADR 0008).
- [x] The player takes food off by hand into the backpack, finished food first, as with fish on a fire.
- [x] A panel shows what hangs on the rack and how far along each food is.
- [x] The rack cannot be taken down while it holds food, as with a chest.

## Drying

- [x] Berries or a mushroom on the rack dry in 6 game hours, with no fire. They become dried berries or a dried mushroom.
- [x] Fresh food on the rack keeps spoiling until it is dried. Spoiled food on the rack vanishes with the usual notice.
- [x] Dried food can stay on the rack for as long as the player likes.
- [x] Rain does not affect drying.

## Dried food

- [x] Dried berries and dried mushrooms never spoil and have no freshness bar.
- [x] They weigh the same and fill the same hunger as berries (0.1) and a mushroom (0.15). They can be stored in chests and shelves and dropped like other food.

## Journal

- [x] The journal gets a last goal, "Preserve some food for winter". It is done the first time any food finishes on a rack.

## Saving

- [x] The rack, the food on it, and its progress are saved. The save version goes up if needed. Older saves load with no racks (ADR 0011).

## The rest

- [x] `GLOSSARY.md` defines Drying rack, Dry, Preserve, Preserved food, Dried berries, and Dried mushroom. This is done already.
- [x] The new drafts are in `asset-manifest.json` with `"status": "draft"` and this ticket's path.
- [x] All player-facing text is in the strings file.
- [x] Unit tests cover building the rack, hanging and taking food, the 6-food limit, drying time, spoiling before drying, dried food never spoiling, the take-down refusal, the journal goal, and saving.

## Comments

- 2026-11-26, implementation: the rack is in the build menu's Furniture tab, after the rain barrel. It needs no tool.
- The action menu offers "Hang berries" and "Hang a mushroom" while the backpack holds them, and "Take food off" while the rack holds food. The main action takes food off once some has dried, or else hangs the first food the player can hang.
- The oldest food in the backpack goes on the rack, and keeps its spoil time. Fresh food taken off gets that time back.
- Cord from a rack taken down that does not fit in the backpack lies in a pile, as planks and stone do.
- The draft model draws the food on the rack at twice its true size, so it reads from the game's camera.
- The build menu icon for the rack is its own draft, `drying-rack-icon`. The dried food icons and piles are `dried-food-icons` and `dried-food-piles`.
