# 01: A chimney through the roof

**What to build:** The player can build a stone chimney on a finished fireplace. It rises up through the roof, and smoke from the lit fireplace comes out of its top, above the cabin. The chimney is only for looks. A fireplace heats its room the same with or without one.

**Status:** resolved

**Assets:** Settled with the owner on 2026-11-25. Add the drafts `chimney` (a stone stack in the same rubble style as `fireplace`, standing on its cap stone, with build stages) and `chimney-icon` (the build menu icon, in the `build-icons` style). Reuse `fireplace`, `fire-effect`, `roof`, and `stone` unchanged.

## Building a chimney

- [x] The build menu lists the chimney with its cost of 8 stone.
- [x] A chimney blueprint snaps only onto a finished fireplace that has no chimney or chimney blueprint yet. Anywhere else, the blueprint shows greyed with the reason.
- [x] A chimney always faces the way its fireplace faces. R does not turn it.
- [x] The player can build a chimney before or after the roof section over its square. A roof frame and roof section can go on over a square that already has a chimney.
- [x] Any finished fireplace can take a chimney, wherever it stands on the foundation.
- [x] Stone reaches a chimney blueprint the way it reaches a fireplace blueprint: from the backpack and from stone piles within 2 m. The blueprint keeps what it has been given.
- [x] The player holds the build action to build it. Building takes 16 seconds and needs no tool.
- [x] A chimney blocks no ground beyond its fireplace's square.
- [x] In the playground, building a chimney spends no stone.

## How it looks

- [x] The chimney stands on the fireplace's cap stone. The `fireplace` asset does not change.
- [x] The chimney top sits about 0.8 m above the roof surface at its spot, so a higher roof section gives a taller chimney. With no roof section over its square, it is as tall as it would be under a roof one rise high. (A roof section blueprint over the square counts as a roof section. "One rise high" means a roof whose surface at the chimney is one rise above its low edge.)
- [x] The stack passes straight through the roof section. No hole is cut, and the `roof` asset does not change.
- [x] A roof section with a chimney through it still keeps the rain off.
- [x] When the roof over the player hides, the chimney stays fully visible.

## Smoke

- [x] Once a chimney is finished, all smoke from its lit fireplace rises from the chimney top. No smoke rises at the hearth.
- [x] Flames, embers, sparks, and light stay in the fire box. (The approved `fire-effect` looks the same. Its code gained a smoke-only fire and a way to hide a fire's own smoke, so the smoke can leave through the chimney.)
- [x] Without a chimney, a fireplace's smoke is the same as today.

## Taking it down

- [x] The player can take down a chimney or its blueprint at any time, even while the fire is lit, and gets back every stone.
- [x] While a chimney or chimney blueprint stands on a fireplace, taking down the fireplace shows greyed with the reason "Take down the chimney first."

## Saving and the rest

- [x] Chimneys and their blueprints, with the stone given to them, are saved. The save version goes up, and older saves are upgraded when loaded (ADR 0011). A fireplace in an older save loads with no chimney.
- [x] A chimney changes nothing in play: warmth, rooms, snug rooms, fuel, and rain work as before.
- [x] The journal gets no new goal.
- [x] `GLOSSARY.md` defines the chimney. This is done already.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [x] Unit tests cover where a chimney blueprint can go, the refusals, stone delivery, building, the chimney height over roofs of different heights, taking down, the fireplace refusal, and saving.
