# 10: Roof frame between walls and roof

**What to build:** The player builds a roof frame on the walls before the roof. A frame is the timber skeleton of one foundation square: level beams on the wall tops that reach out past the walls, and sloped rafters on the beams. The roof is then only bark, laid on the frame. Building order becomes walls, then frame, then roof, like a real house.

**Blocked by:** 06 (Roof), 08 (Take down), 09 (Roof facing and corners)

**Status:** resolved

**Assets:** Reuse `debarked-log`, `bark`, `log-wall`, and `player`. Change the approved `roof` and the draft `roof-corners`, as the owner approved in chat on 2026-11-11: the rafters move from the roof to the frame, and the roof becomes bark only. Add the draft `roof-frame`, with build stages.

## Why

The roof now rests straight on the wall tops, and gaps show between them. Log walls that run along z sit half a log lower than walls that run along x, so their logs interlock at the corners. The roof assumes every wall top is the same height, so it leaves a slot over the lower walls. Fill logs patch this, but they get complicated on hip and valley corners.

A level frame fixes the cause. The roof sits on one flat layer of beams, whatever the walls under it do. The beams reach past the walls, so the join between wall and roof is hidden under the overhang.

## Decisions

All made by the owner on 2026-11-11.

- **One frame per square.** A frame covers one foundation square, like a roof section. The player places it the same way.
- **The frame owns the rafters.** A frame is the level beams and the sloped rafters. It costs debarked logs. The roof costs only bark.
- **The frame sets the slope.** R turns the frame. Its turn sets which way it slopes down. Frames side by side work out heights and hip and valley shapes from each other, as roofs do now (ticket 09). The roof on top follows the frame under it, and has no turn of its own.
- **Old saves get free frames.** When a save from before this change loads, every finished roof gets a finished frame under it, with the roof's turn. Each roof blueprint becomes a frame blueprint with the same turn, keeping its delivered logs. Nothing is lost.

## Tasks

- [x] The build menu lists the roof frame with its cost in debarked logs. The roof's cost becomes bark only.
- [x] A frame needs a foundation and at least one finished log wall or door frame on the square's edges. These are the rules the roof has now.
- [x] A roof needs a finished frame on the same square. The roof takes the frame's turn.
- [x] R turns a frame blueprint. The frame keeps its turn in saves.
- [x] Beams lie level on every wall top of the square, and reach about 0.3 m past the walls. Beams over the lower walls (the walls along z) sit on packing or are thicker, so all beam tops are level.
- [x] Rafters rest on the beams. Their heights and corner shapes come from neighbouring frames, as in ticket 09. That code moves from the roof to the frame.
- [x] No gap shows between the walls and the frame, or between the frame and the roof, from outside the cabin. Where a slope rises above the beams, as at the high side of a slope, logs fill the gap up to the roof.
- [x] The bark of the roof covers the frame's overhang.
- [x] A frame counts as no roof overhead. Only a finished roof keeps the rain off.
- [x] When the player stands under a roof, the frame under it hides with it.
- [x] Taking down: a frame cannot come down while a roof stands on it. A wall or door frame cannot come down while a frame needs it. Taking down a frame gives back its debarked logs.
- [x] Old saves load as described under Decisions. Bump the save version.
- [x] All player-facing text is in the strings file.
- [x] Every asset under **Assets** is in the asset catalogue, reused, changed, or added as a draft (ADR 0006).
- [x] Unit tests cover the frame and roof placement rules, the costs, the support rules for taking down, and loading old saves.

## Notes

- The branch `asset/roof-corners` holds unfinished work on the corner pieces that you may reuse: a split log along each hip ridge, and an open gutter of darker bark in each valley. It is not on `main`. Ask the owner before you use it.
- Construction stages: the frame has one stage per debarked log, the roof one stage per strip of bark.

## Comments

- 2026-11-11: Built in this session. The frame costs 5 debarked logs and takes 12 seconds: two beam logs, each cut in two, then three rafters. The roof costs 4 bark and now takes 8 seconds, since it no longer lays rafters. These numbers were not in the ticket, so the owner may want to tune them.
- The unfinished work on the `asset/roof-corners` branch was not used, since it needs the owner's approval first.
- When an old roof blueprint already had bark spent on it, the save upgrade puts that bark back in the player's backpack. It does not check the backpack's weight limit.
- The `roof` asset stays approved, with its rafters and fill logs moved to the new `roof-frame` draft, as the owner approved.
