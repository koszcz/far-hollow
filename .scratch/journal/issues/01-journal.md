# 01: The journal suggests goals

**What to build:** A journal suggests goals to a new player, from a first campfire to a first snug room. Following it is optional. The game never ends. The journal is milestone 10 in the design spec. Friends of the owner are now interested in playing, so a new player needs a way to learn the game.

**Blocked by:** None

**Status:** ready-for-agent

**Assets:** None. The panel is text only and uses the existing panel style.

## Goals

The journal lists these eight goals in this order:

1. Pick up sticks.
2. Light a campfire.
3. Fell a tree.
4. Build a lean-to.
5. Sleep on a bedroll, anywhere.
6. Build a sawhorse and cut a plank.
7. Build a first room.
8. Make the room snug.

Each goal has one short hint line. The hint names the key and the materials the goal needs, such as "Press B to open the build menu."

## Acceptance criteria

- [ ] A goal is done the first time the player does it. It stays done, even if the player later takes the thing down.
- [ ] Goals can be done out of order. Any goal that happens is marked done.
- [ ] The HUD always shows one short line with the first goal not yet done.
- [ ] J opens and closes the journal panel. Escape closes it. The panel shows the goals not yet done, first ones first, each with its hint. It also shows the goals already done.
- [ ] When a goal is done, the existing notice banner says so, such as "Journal: campfire lit."
- [ ] The panel has a "Hide journal" toggle. It hides the HUD line and the done notices. J still opens the panel. The toggle is saved per game.
- [ ] After the last goal, the panel shows one closing line, such as "Your camp is yours now." The HUD line goes away for good.
- [ ] The playground has no journal. Goals are not marked done there, and J does nothing.
- [ ] Done goals and the hide toggle are saved. The save version goes up. Older saves load with no goals done. Ticket 02 fills them in.
- [ ] All player-facing text is in the strings file.
- [ ] Unit tests cover each goal being marked done, out-of-order goals, the hide toggle, and saving.

## Out of scope

- Teaching the basic controls, such as walking, E for the main action, and the hotbar. That is a separate first-time help.
- Filling in goals for older saves. See ticket 02.
- The word "cabin". Goals say "room" and "snug room".

## Comments

Triaged in a grilling session on 2026-11-22. Decisions are recorded above. The glossary entries **Journal**, **Goal**, and **Bedroll** were added or updated in the same session.
