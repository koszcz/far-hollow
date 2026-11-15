# 04: Backpack ring in place of the weight text

**Status:** ready-for-agent

**Blocked by:** 03

**Assets:** changes the approved `hud`. The owner chose the backpack ring, option 2 in `../capacity.html`, in chat on 2026-11-15. Reuses the `backpack` line icon in `hud`.

**What to build:** See decision 4 and "Backpack ring" in `../spec.md`. The backpack weight stops showing as text. A ring around the backpack icon at the start of the hotbar shows it instead.

- [ ] A cell at the start of the hotbar shows the backpack icon inside a ring, with a thin divider after it.
- [ ] The ring fills with the backpack's weight as a share of its limit.
- [ ] The ring and icon are amber. At 90% of the limit or more, they turn to the warning colour and the icon pulses.
- [ ] Pointing at or focusing the ring shows a label with the exact weight, such as "5.5 of 20 kg". Screen readers read the same text.
- [ ] Pointing at a hotbar cell adds that content's weight to its name label, such as "Plank ×5 · 10 kg".
- [ ] The open chest or shelf shows its weight with the same ring in its heading, in place of text.
- [ ] The "5.5 / 20 kg" text no longer shows anywhere in the HUD.
- [ ] Tests cover the ring's share at empty, part full, and full, the warning at 90%, and the weight label text.
