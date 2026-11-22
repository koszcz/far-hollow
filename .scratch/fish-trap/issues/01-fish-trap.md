# 01: Twist cord, set a fish trap in the river, and take fish from it

**What to build:** The player can twist cord from bark and make a fish trap from cord and sticks. They set the trap at the river's edge. After some hours it holds a fish, and the player comes back to take it. Like a snare, it rewards planning, but it needs no hunting.

**Status:** ready-for-agent

**Assets:** Add the drafts `fish-trap` (a cone basket of sticks, half in the water, with a fish inside when it holds one), `fish-trap-icons` (cord and fish trap icons), and `fish-trap-piles` (cord and fish trap piles). Reuse `river`, `fishing-icons`, and `fishing-piles` for raw fish. The hunting ticket reuses the cord icon and pile later.

## Cord and the fish trap

- [ ] The craft menu lists cord as a hand recipe: 3 bark make 1 cord, with no tool. A cord weighs 0.1 kg.
- [ ] The craft menu lists the fish trap as a hand recipe: 2 cord and 6 sticks, with the knife. A fish trap weighs 1 kg.
- [ ] Cord and fish traps can be dropped, form piles, and can go in a chest or on a shelf.

## Setting a fish trap

- [ ] The river's action menu offers "Set fish trap" after "Fish". Drinking stays the main action.
- [ ] The player approaches the river bank nearest the clicked spot. The trap goes in the water at the edge on the player's side, at the point nearest the clicked spot.
- [ ] Setting a trap is a quick action, not timed work.
- [ ] "Set fish trap" shows greyed, with the reason, when:
  - the backpack holds no fish trap
  - the player carries a log or drags a sled
  - another set fish trap is less than 10 m away.
- [ ] The player can set any number of fish traps.

## Catching and taking fish

- [ ] A set fish trap catches one fish after 6 to 12 game hours. The time comes from the game's seeded random numbers and is drawn again after each catch. Time runs on while the player sleeps.
- [ ] A fish trap holds one fish and catches nothing more until the player takes it.
- [ ] A set fish trap shows whether it holds a fish.
- [ ] "Take fish" is the main action of a fish trap that holds one. It needs no tool and puts 1 raw fish in the backpack. The trap stays set.
- [ ] If the fish does not fit in the backpack, "Take fish" shows greyed with the reason.
- [ ] "Pick up" puts an empty set fish trap back in the backpack. On a trap that holds a fish, "Pick up" shows greyed with the reason "Take the fish first."

## Saving and the rest

- [ ] Cord, fish traps in the backpack, and set fish traps are saved. A set fish trap is saved with its spot, whether it holds a fish, and its time to the next catch. The save version goes up, and older saves are upgraded when loaded.
- [ ] The catch rule (a time drawn from a range, one catch held until emptied) is a value object that the snare can reuse later (ADR 0009).
- [ ] The journal gets no new goal.
- [ ] `GLOSSARY.md` defines cord and the fish trap. This is done already.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover both recipes, where a trap can be set, the refusals, the catch time, holding one fish, taking the fish, the full-backpack refusal, picking up, and saving.
