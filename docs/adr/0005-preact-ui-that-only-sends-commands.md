# The UI is Preact, and it only reads state and sends commands

Menus, the backpack, the build menu, and the radial menu are built with Preact, using HTML and CSS layered over the 3D view. The UI reads game state and sends commands to the game logic. It never changes game state directly. We chose this so every change to the game goes through one path that can be tested, saved, and checked, whether it starts from a click in the world or a button in a menu.

## Considered options

- **Plain DOM code**: rejected. The backpack and build menu have enough nested state that hand-written DOM updates would get messy.
- **Drawing the UI inside the 3D view**: rejected. Text, layout, and accessibility are far easier in HTML.
