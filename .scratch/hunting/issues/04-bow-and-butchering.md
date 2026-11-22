# 04: Make a bow and arrows, shoot a deer, and butcher it

**What to build:** The player can craft a bow and arrows, shoot a deer from up to 25 m, and butcher a killed deer for 8 raw meat. A new deer arrives 2 days after each kill.

**Blocked by:** 01 (Cord and snare), 03 (Deer in the valley)

**Status:** deferred

**Assets:** Reuse `player`, `deer`, and `deer-animations`. Add the drafts `bow`, `bow-animation`, `butcher-animation`, `deer-animations` (fall), `hunting-icons` (bow and arrow icons), and `hunting-piles` (bow and arrows).

- [ ] The craft menu lists the bow as a hand recipe: 2 sticks and 1 cord, with the knife. The bow is a tool and weighs 0.8 kg.
- [ ] The craft menu lists arrows as a hand recipe: 1 stick makes 2 arrows, with the knife. An arrow weighs 0.1 kg.
- [ ] "Shoot" is the main action of a living deer. Without the bow or an arrow, it shows greyed with the reason.
- [ ] The player must be within 25 m with a clear line to the deer. If not, they walk closer first, and the deer may notice them.
- [ ] The player draws for 2 seconds without moving, then shoots. If the deer runs out of range during the draw, the shot is not taken and the arrow is kept.
- [ ] A shot always hits within 8 m and hits half the time at 25 m, with an even change in between. It uses the game's seeded random numbers.
- [ ] A hit kills the deer. A miss makes the deer run. Every shot uses up the arrow.
- [ ] A killed deer lies where it fell. "Butcher" is its main action. It needs the knife and takes 10 seconds of held work.
- [ ] Butchering gives 8 raw meat. Meat that does not fit in the backpack drops in a pile beside the deer. Then the deer is gone.
- [ ] A killed deer that is not butchered is gone after 1 day.
- [ ] A new deer walks in from the valley's edge 2 days after each kill, so the valley returns to 6 deer.
- [ ] The player plays `bow-animation` and `butcher-animation`. The deer plays its fall.
- [ ] The bow and arrows can be dropped, form piles, and can go in a chest or on a shelf.
- [ ] The bow, arrows, killed deer, and the time until each new deer arrives are saved. The save version goes up, and older saves are upgraded when loaded.
- [ ] `GLOSSARY.md` defines the bow and the arrow as the spec does.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover both recipes, range and line of sight, the chance to hit, a hit, a miss, butchering, a full backpack, and new deer arriving.
