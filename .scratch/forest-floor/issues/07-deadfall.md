# 07: Sticks lie in deadfalls

**What to build:** Most sticks lie in **deadfalls** instead of one by one, so finding one spot pays off with several sticks. A new valley starts with more sticks: about 1,300 instead of 700.

**Blocked by:** None

**Status:** resolved

**Assets:** Reuses `sticks`. Adds none.

A deadfall is a few sticks that fell together under one tree. See `GLOSSARY.md`. Each stick in a deadfall is still its own stick. The player picks them up one at a time.

- [x] A new valley has about 250 deadfalls of 3 to 6 sticks each.
- [x] A new valley also has about 200 lone sticks.
- [x] Each deadfall lies under one tree, in the same ring around the trunk that sticks use today.
- [x] The sticks in a deadfall lie at random angles and overlap a little. They do not look neatly arranged.
- [x] The same seed always places the same deadfalls and lone sticks.
- [x] Saved games load as before. Their sticks stay where they are.
- [x] Unit tests cover the stick count, the deadfall sizes, and the same seed giving the same sticks.

Note: food is placed after sticks when a valley is made. Changing the sticks may move berry bushes and mushrooms for a given seed. That is fine for new games. Saved games store their own food spots, so they do not change.
