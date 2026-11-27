# Implementer brief for a ticket run

You build one ticket of a run and land it on `main`. The lead session gave you the feature, the ticket, and maybe a notes file. Read the ticket, its spec at `.scratch/<feature>/spec.md`, and the notes. Read AGENTS.md for the repo's rules.

## Report on the run board

The owner watches the run in the pipeline panel. Your ticket's line shows the state and note you record:

```sh
.claude/skills/ticket/status.sh set <feature> <NN> building "<note>"
```

Record a short note, at most 40 characters, at each milestone: "reading", "red: 4 tests", "green", "make check", "conflict in reach.ts". Set `landing` when you start `make land`. The lead session sets `landed` and `failed`.

Your worktree's guard refuses `$(git …)` inside another command, `&&` chains with git, heredocs, and loops. Send one plain command per Bash call.

## Steps

1. **Start from main.** Run `git merge-base --is-ancestor main HEAD`. If it fails, run `git reset --hard main`. Create your branch with `git switch -c <feature>-<NN>`. Set your ticket to `building` with the note "reading". Done when your branch starts at the tip of local `main`.
2. **Build it test-first.** Call the Skill tool with `mattpocock-skills:tdd` and build the ticket. Follow the ticket's `**Assets:**` line and the Assets section of AGENTS.md. Before you play the game in a browser or take a screenshot, read `docs/agents/game-testing.md` and check behaviour through game state. Take a screenshot only for a visual result, such as a model, a texture, or the layout. Done when every acceptance item of the ticket has a passing test or a check you ran.
3. **Resolve it.** Set the ticket file's `Status:` line to `resolved`. Run `make fix`, then commit your work. Done when `git status` is clean.
4. **Land it.** Set your ticket to `landing`. Run `make land`. On a merge conflict, resolve it, commit, and run `make land` again. If `make check` fails, fix the cause and run it again. Done when `make land` reports that your branch is on main.

## Report to the lead session

Reply in at most five lines: landed or not, the commit on `main`, and anything the owner must decide. If you could not land, say what blocks you and set your note to the reason.
