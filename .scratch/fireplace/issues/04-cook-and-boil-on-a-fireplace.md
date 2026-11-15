# 04: Cook fish and boil water on a fireplace

**What to build:** The player can cook fish and boil water in the pot on a lit fireplace, the same way as on a campfire.

**Blocked by:** 03 (Fire in a fireplace)

**Status:** ready-for-agent

**Assets:** Reuse `fireplace`, `fish-on-fire`, and `pot`.

- [ ] The player puts raw fish on a lit fireplace within reach. It holds up to 3 fish.
- [ ] Fish cook in the same time as on a campfire. Fish on a fireplace that is out keep their progress.
- [ ] The player takes fish off a fireplace, cooked fish first, as far as they fit in the backpack.
- [ ] The player puts the pot on a fireplace and takes it off, as with a campfire.
- [ ] Water boils in the same time as on a campfire.
- [ ] The fish and the pot show on the fireplace.
- [ ] The fireplace's action menu and panel offer and show the same things as a campfire's.
- [ ] The player cannot take down a fireplace that holds a pot or fish. The action shows greyed with the reason.
- [ ] The pot and the fish on each fireplace are saved, with their progress. The save version goes up, and older saves are upgraded when loaded.
- [ ] Cooking and boiling on a campfire work as before.
- [ ] `GLOSSARY.md` says the player cooks on a lit campfire or fireplace.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover cooking, taking fish off, boiling, and taking down a fireplace that holds a pot or fish.
