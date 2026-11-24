# 12: Centred ridge on a roof an odd number of squares wide

**What to build:** On a cabin an odd number of squares across the slope, such as 3 wide, put the ridge in the middle. The middle roof frame and roof section become a ridge section. A ridge section slopes down both ways from a ridge along its middle. Both slopes are then as long, and the gable ends are symmetric triangles.

**Blocked by:** 11 (Steep plank gable roof)

**Status:** resolved

**Assets:** The owner asked for this change in chat on 2026-11-24.

- Change `roof`: the middle section of an odd-width roof is a ridge section, with two half slopes of 6 rows each.
- Change `roof-frame`: the middle frame of an odd-width roof has three pairs of rafters that meet over a ridge pole along its middle.
- Reuse `gable-end`. Its shape follows the roof by itself.

## Why

Each roof frame slopes one way only. On a 3-wide cabin, the middle frame had to slope with one side. That side was one section longer, so its slope stood one rise higher than the other side's. The ridge was off centre, with a one-rise step at the top.

## Rule

The game rules do not change. The player still turns each frame. The layout works out the shape from the frames round it (`src/render/roof-layout.ts`):

- A section becomes a ridge section when its run has at least one section in front of it, and the section just behind it slopes the opposite way with a run one section shorter.
- So the middle frame of an odd-width roof becomes a ridge section whichever way the player turns it.
- An even-width roof, a shed roof, and a roof set off centre on purpose (such as 1 and 3 on a 4-wide cabin) keep their straight sections.

## Acceptance criteria

- [x] On a 3-wide and a 5-wide roof, the middle section is a ridge section, and every edge between sections meets with no step.
- [x] Even-width, shed, and off-centre roofs do not change.
- [x] The planks of a ridge section lap over the sections on both sides.
- [x] The frame of a ridge section has paired rafters and a ridge pole along its middle.
- [x] The `roof` and `roof-frame` showcases show a cabin 3 squares deep with a centred ridge.
