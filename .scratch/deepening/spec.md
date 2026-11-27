# Deepening: fewer places to edit for each new action

## Problem

Adding one action to the game takes edits in many files. The commit that let the player lay a bedroll in a lean-to (58f1188) touched 15 files. The action queue (fe11a74) touched 20.

An architecture review on 2026-11-16 found six causes. Each ticket below removes one.

- The same "walk within reach, then act" code is copied into about 20 sim modules. They use four different walking functions.
- A command's refusal and the code that runs it are separate copies of one rule. Some already disagree.
- Each command's meaning is spread over the `Command` union, `commandRules`, a task component, the save schema, and the activity module.
- The action queue guesses when an action is done from which task components the player has. Sitting and fishing are special cases inside `src/sim/game.ts`.
- Each furniture piece is its own kind of pick, so the action menu has one switch case per piece.
- A few UI paths copy sim rules or skip the refusal check.

## Terms

These tickets use the architecture words below.

- **Module**: anything with an interface and an implementation, from one function to a folder.
- **Interface**: everything a caller must know to use a module: types, ordering rules, and error cases.
- **Deep module**: a module with a lot of behaviour behind a small interface. A **shallow** module has an interface nearly as large as its implementation.
- **Seam**: the place where a module's interface sits, where behaviour can change without editing the callers.

## What does not change

- ADR 0001: the sim does not import three.js.
- ADR 0003: the sim stays an ECS on miniplex.
- ADR 0005: the UI only reads state and sends commands.
- ADR 0008: the game decides refusals. The UI decides the order of actions, their labels, and which is the main action.
- No ticket changes how the game plays, except where a ticket names a bug it fixes.

## Tickets

1. `issues/01-one-reach-module.md`: one module for walking within reach of a thing, then acting. It moves the act-once tasks.
2. `issues/02-run-only-after-refusal.md`: the game checks a command's refusal before it runs it.
3. `issues/03-activity-modules-own-their-command-rules.md`: each activity module declares its own command rule.
4. `issues/04-action-queue-module.md`: the action queue becomes its own module and asks each rule whether its action is done.
5. `issues/05-furniture-is-one-kind-of-pick.md`: furniture is one kind of pick, and each definition names its use.
6. `issues/06-close-ui-leaks.md`: small fixes where the UI copies sim rules or skips refusals.
7. `issues/07-timed-tasks-use-the-approach.md`: timed tasks, such as chopping, walk to their thing through the approach module.
8. `issues/08-one-module-per-player-motion.md`: each player motion lives in its own module, so parallel asset sessions stop colliding in `player-mesh.ts`. It came from a retrospective on 2026-11-21, not from the architecture review. It needs no other ticket.
9. `issues/09-one-file-per-animation-showcase.md`: each animation showcase lives in its own file, so two new showcases merge without a conflict. Triage split it out of ticket 08 on 2026-11-21. It needs no other ticket.

Tickets 02, 05, and 06 can start now. Ticket 01 needs 02. Ticket 03 needs 01, 02, 04, and 07. Ticket 04 needs 02. Ticket 07 needs 01.

The review report with before and after diagrams was written to a temporary file and is not kept. This spec and the tickets hold everything it said.

## Second review, 2026-11-27

A second architecture review looked at the files that changed most in the last 200 commits. It found six more places where a module is shallow. Each ticket below is an `idea` and needs grilling.

10. `issues/10-stored-commands-declare-their-save-shape.md`: the save check knows the shape of every action command, and a bad approach is dropped on load instead of breaking the save. Grilled on 2026-11-27.
11. `issues/11-pose-director.md`: the player posing module returns a pose as plain data instead of moving the mesh, so tests can reach it.
12. `issues/12-reach-for-hud-panels.md`: the HUD panels find things through the reach module, so a thing behind a wall shows no panel.
13. `issues/13-furniture-definition-owns-its-piece.md`: a furniture definition also answers emptiness, save, nearby view, and use labels.
14. `issues/14-one-name-and-icon-per-command.md`: the action menu and the queue read one label and icon per command.
15. `issues/15-announcements-module.md`: tests check the notice timing rules directly through the game notices module.
16. `issues/16-save-while-walking-to-a-chest.md`: a save made while the player walks to a chest loads again. The grilling of ticket 10 split this small fix out.
17. `issues/17-save-versions-only-for-real-changes.md`: a new kind adds a save version only when the stored data changes. The grilling of ticket 10 split this out too.

Ticket 16 goes first, because it fixes a bug that loses the player's progress. Ticket 10 follows it. The rest can start in any order. File-length tickets 07 and 11 already moved the notice and pose code into their own files, so tickets 11 and 15 deepen those files.
