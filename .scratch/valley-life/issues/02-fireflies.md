# 02: Fireflies glow at night

**What to build:** At night, fireflies drift and blink over clearings and the river bank near the player. Fireflies are only for looks. See `.scratch/valley-life/spec.md`.

**Blocked by:** none

**Status:** ready-for-agent

**Assets:** Add the draft `fireflies`, built in code: small glowing dots that drift and blink. Reuses nothing. Decided with the owner on 2026-11-22.

## Where and when fireflies show

- [ ] Fireflies show only at night. They fade in at dusk and out at dawn, following daylight.
- [ ] Up to 40 fireflies glow over clearings and the river bank, only near the player.
- [ ] Each firefly drifts slowly and blinks.
- [ ] A firefly is a glowing dot. It does not light the ground.
- [ ] No fireflies show while it rains.
- [ ] Fireflies ignore the camp and fire.

## Only for looks

- [ ] Fireflies are drawn by the renderer only. The game logic never sees them.
- [ ] Fireflies are not saved. The save version does not change.
- [ ] Fireflies start in new random places each time the game loads.
- [ ] The playground has fireflies.

## Assets and checks

- [ ] The `fireflies` entry in `asset-manifest.json` is `draft` and links this ticket.
- [ ] The asset showcase shows fireflies glowing, so the owner can review them.
- [ ] The game still runs at 60 fps on an Apple M1 laptop in Chrome with 40 fireflies in view.
- [ ] Unit tests cover the firefly count, fireflies following daylight, staying away in rain, and showing only over clearings and the river bank.
