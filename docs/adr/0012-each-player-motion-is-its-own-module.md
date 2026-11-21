# Each player motion is its own module, listed in a registry that git merges by union

Each animation asset that poses the player in code, such as fishing or crafting by hand, lives in one module. That module holds the motion's pose, its props, its constants, and the paragraph that names its asset. The player mesh lends each motion a rig and runs the motions from a list. The renderer drives every such motion through one call, `setMotion(id, moment)`. Each animation showcase also lives in its own file. Both lists are marked `merge=union` in `.gitattributes`, so two branches that each add a line merge without a conflict.

We chose this after six asset branches changed the player mesh in one afternoon on 2026-11-21, and two of them conflicted there. Polishing one motion edited the same lines as every other motion. Now a new motion adds one file and one line to the list.

## The parts

- **The rig** is what the player mesh lends a motion: the player's group, the bones used for posing, a `material()` helper that the mesh disposes of, and read-only state, such as whether a log is carried and how far the player has walked.
- **A motion** is made by `create<Name>Motion(rig)`. It gives back `update(moment, now)`, `pose()`, `placeProps()`, and `dispose()`. It is built on `createWorkMotion`, so its start time and standing back up work as before. It declares whether the axe goes on the back while it plays.
- **Layers.** A `body` motion poses the whole body, and the first active one in the list wins. An `upperBody` motion, such as eating, poses the arms and head over whatever body motion plays. An `overlay`, such as the lit torch, has no pose. It only places its props, after every other motion.

## Considered options

- **A typed setter on the player mesh for each motion**: rejected. Each new motion would add a method to the player mesh and a call to the renderer, which is the collision this ADR removes.
- **A registry generated at build time**: rejected. Bun has no `import.meta.glob`, and a generated file adds a build step for a problem that a one-line `.gitattributes` entry solves.

## Consequences

- A union merge can keep both copies of a line. A duplicate entry in either list fails the typecheck, so `make land` catches it.
- Motions that only choose a clip, such as chopping, sleeping, sitting, and reaching, keep their setters on the player mesh for now. So does the carried log.
