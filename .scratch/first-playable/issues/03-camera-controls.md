# 03: Camera controls

**What to build:** The player can look around the valley. The camera looks down at an angle. The player can rotate it, zoom, pan, and change the angle within limits.

**Blocked by:** 02 (Seeded valley with a river and trees)

**Status:** resolved

- [x] Right-drag pans the camera.
- [x] Q and E, or Option + right-drag, rotate the camera.
- [x] The scroll wheel, two-finger scroll, and pinch all zoom.
- [x] Camera pitch stays between about 30° and 75°.
- [x] WASD and the screen edges pan the camera when follow is off.
- [x] A setting turns camera follow on or off. It is on by default.
- [x] Camera input does not change game state. The camera is a rendering concern only.
- [x] Unit tests cover the pitch limits and zoom limits.
