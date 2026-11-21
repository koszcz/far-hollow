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

Tickets 02, 05, and 06 can start now. Ticket 01 needs 02. Ticket 03 needs 01 and 02. Ticket 04 needs 02. Ticket 07 needs 01.

The review report with before and after diagrams was written to a temporary file and is not kept. This spec and the tickets hold everything it said.
