# HUD redesign: spec

The owner finds the HUD hard to use, even after the hotbar and wheel layout of ticket 01. It takes a while to learn what to click, and it stays hard after that. This spec makes every action easy to find and keeps each action in one place.

Terms in **bold** are defined in `GLOSSARY.md`. The hotbar and wheel layout from `issues/01-hotbar-and-wheel.md` stays. This spec changes how the player acts, not where the HUD sits.

## Goals

- The player can always see what a click will do before they click.
- Each action lives in one place: on the thing it acts on.
- Nothing important hides behind a gesture the player must remember.
- The screen teaches the keyboard shortcuts as the player plays.

## What is wrong today

The owner played the game on 2026-11-12 and named four problems.

| Area | Problem |
| --- | --- |
| Clicks on the world | Pointing at a tree outlines it, but nothing says what a click does. Extra actions, such as debarking, hide behind a right-click. |
| Hotbar items | The icons are small and have no names. A click on an item drops it, which surprises the player. |
| Build and craft | They are two small icon buttons, with no names, at the far end of the hotbar. |
| Context panels | The campfire, woodpile, bedroll, and pile panels are full of text and buttons. The same thing can be done in four places: a click on the world, the right-click menu, a panel, or the hotbar. |

## Decisions

The owner made these choices in chat on 2026-11-12.

1. **Cursor prompt.** A small label beside the cursor names the thing under it and what a left-click and a right-click do.
2. **Actions move onto things.** The buttons in the context panels become actions on the thing itself. Panels keep only status, such as how much fuel a fire has.
3. **Right-click opens a full menu.** The menu lists every action the thing offers, with icons. An action the player cannot do yet shows greyed, with the reason.
4. **A click on a hotbar item uses it.** Food is eaten, the bedroll is laid, and a pot is filled or drunk from. A right-click opens a menu with Use and Drop.
5. **Keyboard shortcuts show on screen.** This reverses the 2026-11-11 choice of no number keys and no shortcut labels.

## Cursor prompt

- The prompt shows beside the cursor whenever the cursor is over something the player can act on.
- It shows the thing's name, then one line per mouse button:
  - Left-click: the main action, such as "Chop".
  - Right-click: "More actions", only if the thing has a menu with more than the main action.
- If the main action cannot happen yet, the line is greyed and says why, such as "Chop: needs the axe".
- The prompt does not show over plain ground, where a click walks.
- The prompt also shows over hotbar items, the build button, and the craft button. It replaces the tooltips there.

## Main action for each thing

A left-click does the main action. If the player is out of reach, they walk to the thing first, then do it.

| Thing | Main action |
| --- | --- |
| Ground | Walk there |
| River | Drink |
| Tree | Chop |
| Log or debarked log | Pick up |
| Stick, bark, or pile | Pick up |
| Forage spot | Forage |
| Campfire, unlit | Light it, if it has fuel. Otherwise add fuel. |
| Campfire, lit | Add fuel: firewood first, then a stick, then bark |
| Woodpile | Stack the carried log on it. If the player carries nothing, take firewood. |
| Chest | Open it |
| Laid bedroll | Sleep |
| Blueprint | Deliver the carried material, or build, as now |
| Work station | Open its menu |

The cursor prompt always names the exact action, so the player never has to know these rules.

## Right-click menu

- A right-click on a thing opens a small menu at the cursor.
- The menu lists every action the thing offers, the main action first.
- Each entry has an icon and a name. A disabled entry is greyed and says why, such as "Add bark: no bark".
- Picking an entry walks the player to the thing if needed, then does the action.
- Actions that today need a shift-click get their own entry, such as "Stack all firewood".

| Thing | Menu entries |
| --- | --- |
| Campfire | Light, Add firewood, Add a stick, Add bark, Put the pot on, Take the pot off, Take down |
| Woodpile | Stack the log, Stack firewood, Stack all firewood, Take a log, Take a debarked log, Take firewood, Take down |
| Laid bedroll | Sleep, Pick up |
| Log | Pick up, Debark |
| Chest | Open, Take down |
| Blueprint or structure | Take down |
| Work station | Each recipe made there, then Take down |

## Hotbar

- Each item cell is larger and shows the item's name under its icon. A count shows when there is more than one.
- The first nine cells show the keys 1 to 9. Pressing a key uses that item.
- A left-click uses the item. Items with no use do nothing, and the cursor prompt says so.
- A right-click opens a menu with Use, when the item has a use, and Drop.

| Item | Use |
| --- | --- |
| Berries, mushroom | Eat one |
| Bedroll | Lay it out |
| Empty pot | Fill it at the river. The player walks to the nearest river bank first. |
| Pot of river water or boiled water | Drink |

- The Eat, Lay out bedroll, Fill the pot, and Drink buttons leave the hotbar.
- With a chest open, a left-click still puts the item in the chest.
- A log or debarked log on the shoulder shows as a separate cell at the start of the hotbar. A left-click drops it. A right-click offers Drop and Split.

## Build, craft, and needs

- The build and craft buttons become larger buttons with a name and a key label: "Build B" and "Craft C".
- They sit at the right end of the hotbar, apart from the items.
- Each need bar shows its name beside its icon.
- The placing hint names its keys: "R to rotate · Esc to cancel".

## Use key

- E does the main action on the nearest thing within reach.
- The cursor prompt shows "E" on that thing's main action when it is the nearest.

## Context panels

- The campfire, woodpile, bedroll, and pile panels lose their buttons. They keep their status: fuel, pot progress, woodpile contents, and blueprint deliveries.
- The carrying panel goes away. Its actions move to the shoulder cell in the hotbar.
- The open chest keeps its panel and its grid, because it is a second backpack.
- The timed work bar stays.

## Out of scope

- The look of the HUD: colours, panel style, and fonts stay.
- The build and craft wheels stay as they are, apart from their buttons.
- Gamepad and touch controls.
- A tutorial or first-run guide.
