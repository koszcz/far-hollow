# 01: A chimney through the roof

**What to build:** The player can build a stone chimney on a finished fireplace. It rises up through the roof, and smoke from the lit fireplace comes out of its top, above the cabin. The chimney is only for looks. A fireplace heats its room the same with or without one.

**Status:** ready-for-agent

**Assets:** Settled with the owner on 2026-11-25. Add the drafts `chimney` (a stone stack in the same rubble style as `fireplace`, standing on its cap stone, with build stages) and `chimney-icon` (the build menu icon, in the `build-icons` style). Reuse `fireplace`, `fire-effect`, `roof`, and `stone` unchanged.

## Building a chimney

- [ ] The build menu lists the chimney with its cost of 8 stone.
- [ ] A chimney blueprint snaps only onto a finished fireplace that has no chimney or chimney blueprint yet. Anywhere else, the blueprint shows greyed with the reason.
- [ ] A chimney always faces the way its fireplace faces. R does not turn it.
- [ ] The player can build a chimney before or after the roof section over its square. A roof frame and roof section can go on over a square that already has a chimney.
- [ ] Any finished fireplace can take a chimney, wherever it stands on the foundation.
- [ ] Stone reaches a chimney blueprint the way it reaches a fireplace blueprint: from the backpack and from stone piles within 2 m. The blueprint keeps what it has been given.
- [ ] The player holds the build action to build it. Building takes 16 seconds and needs no tool.
- [ ] A chimney blocks no ground beyond its fireplace's square.
- [ ] In the playground, building a chimney spends no stone.

## How it looks

- [ ] The chimney stands on the fireplace's cap stone. The `fireplace` asset does not change.
- [ ] The chimney top sits about 0.8 m above the roof surface at its spot, so a higher roof section gives a taller chimney. With no roof section over its square, it is as tall as it would be under a roof one rise high.
- [ ] The stack passes straight through the roof section. No hole is cut, and the `roof` asset does not change.
- [ ] A roof section with a chimney through it still keeps the rain off.
- [ ] When the roof over the player hides, the chimney stays fully visible.

## Smoke

- [ ] Once a chimney is finished, all smoke from its lit fireplace rises from the chimney top. No smoke rises at the hearth.
- [ ] Flames, embers, sparks, and light stay in the fire box.
- [ ] Without a chimney, a fireplace's smoke is the same as today.

## Taking it down

- [ ] The player can take down a chimney or its blueprint at any time, even while the fire is lit, and gets back every stone.
- [ ] While a chimney or chimney blueprint stands on a fireplace, taking down the fireplace shows greyed with the reason "Take down the chimney first."

## Saving and the rest

- [ ] Chimneys and their blueprints, with the stone given to them, are saved. The save version goes up, and older saves are upgraded when loaded (ADR 0011). A fireplace in an older save loads with no chimney.
- [ ] A chimney changes nothing in play: warmth, rooms, snug rooms, fuel, and rain work as before.
- [ ] The journal gets no new goal.
- [ ] `GLOSSARY.md` defines the chimney. This is done already.
- [ ] All player-facing text is in the strings file.
- [ ] Every asset under **Assets** is in the asset catalogue, reused or added as a draft (ADR 0006).
- [ ] Unit tests cover where a chimney blueprint can go, the refusals, stone delivery, building, the chimney height over roofs of different heights, taking down, the fireplace refusal, and saving.
