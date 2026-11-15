# HUD restyle: spec

The owner finds the HUD plain. They like its woody colours but want a more finished look. This spec changes how the HUD looks. It keeps where things sit and how the player acts, as set by `.scratch/hud-redesign/spec.md`.

Terms in **bold** are defined in `GLOSSARY.md`.

## Decisions

The owner made these choices in chat on 2026-11-15.

1. **Variant C, "Smoked walnut".** The owner picked it from four mockups in `mockups.html` in this folder. Open the page and choose the "C · Smoked walnut" tab.
2. **Need gauges.** The four need bars become round gauges, in one group to the left of the **hotbar**.
3. **Names on point only.** **Hotbar** cells drop the name under their icon. A cell shows its name in a label above it when the player points at it or moves keyboard focus to it. This reverses the 2026-11-12 choice to always show names, and the owner chose it knowing that.
4. **Backpack ring.** The **backpack** weight stops showing as text such as "5.5 / 20 kg". A backpack cell at the start of the hotbar shows the load as a ring instead. See option 2 in `capacity.html`.

The mockups draw over a game screenshot, `scene.jpg`, which is not in git because the asset check rejects images that are not in the asset catalogue. Without it, the pages show a dark background, and the "Current" tab, which uses `current.jpg`, is empty. To get it back, run the game at `?seed=42`, hide the `#ui` layer, and save a 1280 by 800 screenshot as `scene.jpg` here.

## The look

Use the colours below. Each one is used as described.

| Part | Value | Used for |
| --- | --- | --- |
| Glass | `rgb(38 24 15 / 0.62)` with `backdrop-filter: blur(12px) saturate(1.2)` | Every HUD box: the clock, the pause button, banners, the need group, the hotbar, **panels**, and menus |
| Edge | 1 px `rgb(255 214 170 / 0.16)` | The border of every glass box, and dividers |
| Amber | `#f0a04b` | The accent colour. It marks focus, the pointed cell, the Build and Craft buttons, and the backpack ring. |
| Warning | `#e0573a` | A full backpack |
| Text | `#f6ead8` | All text. Secondary text uses the same colour at 60% opacity. |

- Corners are round. Boxes use a 14 to 18 px radius. Small boxes, such as the clock, banners, and name labels, are pills.
- Each box has a soft shadow: `0 10px 30px rgb(0 0 0 / 0.35)`.
- Text uses the font stack `"Avenir Next", "Segoe UI", system-ui, sans-serif`. Bundling a font so every machine matches is out of scope.
- Where `backdrop-filter` is missing, the glass falls back to the same colour at 0.9 opacity.

## Each part of the HUD

| Part | Look |
| --- | --- |
| Clock | A pill, top left. The sun icon sits in a ring that fills as the day passes. The time of day follows as a word, such as "morning", in secondary text. |
| Pause | A round glass button, top right |
| Banners | Pills at the top centre, each led by a small glowing amber dot |
| Need gauges | A glass group left of the hotbar. Each **need** is a 42 px ring in its own colour, with its icon inside and its name below in 10 px text. A low need pulses, as today. |
| Hotbar cells | 58 px square, with a 12 px radius and a faint light fill. The icon is 38 px. The number key sits bottom left at 50% opacity. The count sits top right. The pointed or focused cell gets an amber outline and its name label. |
| Build and Craft | Two 58 px square buttons at the right end of the hotbar, side by side. Each has an amber tint, an icon over its name, and its key in the top right corner. |
| Backpack ring | See "Backpack ring" below |
| Action, build, and craft menus | Glass lists. A heading in small capitals at 60% opacity. The pointed row gets an amber tint. |
| Panels and the open chest | Glass boxes in the same style, in the dock above the hotbar, as today |
| Start screen | Glass save-slot cards in the same style |

## Backpack ring

- A cell at the start of the hotbar shows the backpack icon inside a ring. A thin divider separates it from the backpack contents.
- The ring fills with the backpack's weight as a share of its limit.
- The ring and icon are amber. When the backpack reaches 90% of its limit, the threshold the HUD uses today, they turn to the warning colour and the icon pulses.
- Pointing at the ring shows a label with the exact weight, such as "5.5 of 20 kg". Screen readers read the same text.
- Pointing at a hotbar cell adds its weight to its name label, such as "Plank ×5 · 10 kg".
- The open chest or shelf shows its own weight with the same ring, in its heading, in place of text.

## Small screens

The hotbar cells narrow and scroll sideways, as today. When the screen is too narrow for the need group and the hotbar side by side, the need group moves above the hotbar.

## Out of scope

- New icons. Every icon stays as it is.
- Clicking the backpack ring to open the full backpack. That may come later.
- Changes to what any control does.
