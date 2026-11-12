# 02: Cursor prompt for the thing under the mouse

**Status:** resolved

**Assets:** changes the approved `hud`. The owner asked for this redesign in chat on 2026-11-12. Reuses the approved `backpack-icons`, `build-icons`, and `hud-icons`, and the draft `crafting-icons`.

**What to build:** See "Cursor prompt" and "Main action for each thing" in `../spec.md`. A label beside the cursor names the thing under it and what each mouse button does.

- [x] Over anything the player can act on, a prompt beside the cursor shows the thing's name and its left-click action.
- [x] The prompt shows "Right-click: More actions" when the thing's right-click menu offers more than its main action.
- [x] A main action the player cannot do yet is greyed, with the reason, such as "Chop: needs the axe".
- [x] Plain ground shows no prompt.
- [x] Hotbar items and the build and craft buttons show the same prompt in place of their tooltips.
- [x] The prompt follows the cursor without lowering the frame rate below the targets in `.scratch/first-playable/spec.md`.
- [x] Tests cover the prompt text for each kind of thing, including a greyed main action.
