# 04: Forage, eat, and drink

**What to build:** The player shows a short motion when they forage, eat, drink, or fill the pot. See `.scratch/player-motions/spec.md`.

**Blocked by:** 03 (it reuses the bend down)

**Status:** resolved

**Assets:** Reuse `player`, `pot`, and `pick-up-animation`. Add draft `forage-eat-drink-animation`.

- [x] Foraging a berry bush plays a reach into the bush at chest height. Foraging mushrooms reuses the bend down from `pick-up-animation`.
- [x] Eating raises one hand to the mouth twice.
- [x] Drinking from the river kneels at the bank and raises cupped hands to the mouth.
- [x] Filling the pot kneels at the bank and dips the pot into the water. The pot shows in the hand while it does.
- [x] Drinking from the pot raises the pot to the mouth. The pot shows in the hands while it does.
- [x] Each motion takes about one second, faces the bush, patch, or river, and plays once.
- [x] Walking or another action cuts the motion short.
- [x] The motions take no game time. Game rules do not change.
- [x] The asset showcase shows each motion.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
