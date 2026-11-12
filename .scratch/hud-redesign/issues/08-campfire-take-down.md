# 08: Take down a finished campfire

**Status:** resolved

**Assets:** none. This ticket changes no asset.

**What to build:** The spec's "Right-click menu" table lists "Take down" for the campfire. The sim refused to take down a finished campfire, so ticket 03 left that entry out. The owner decided in chat on 2026-11-12 that a finished campfire can be taken down. The sim now allows it, and the campfire's right-click menu ends with "Take down".

- [x] The player can take down a finished campfire. It comes down like other structures, after half its build time, and gives back the sticks it cost.
- [x] A lit campfire goes out when it comes down. Any fuel still in it is lost.
- [x] A campfire with a pot on it is refused. The player must take the pot off first.
- [x] The campfire's right-click menu lists "Take down" last. It is greyed with the reason "take the pot off first" while a pot is on the fire.
- [x] Tests cover the sim rule and the menu entry.

## Comments

The implementer chose these rules, following how other structures come down. A lit fire may come down, so the player need not wait for it to burn out. The fuel is lost, because the sim stores it as minutes of burning, not as sticks or bark. A pot on the fire refuses the work with the same notice as a chest that still holds something, so the pot is never lost.
