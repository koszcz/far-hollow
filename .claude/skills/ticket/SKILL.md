---
name: ticket
description: Run a whole spec, or one ticket, through implement-spec, landing each ticket on main and showing the run as one card in the pipeline panel.
disable-model-invocation: true
---

# Run a spec's tickets

You lead a **run**: the tickets of one spec, each built by its own implementer subagent and landed on `main`. You build no ticket yourself. You keep the frontier moving and the run board current.

## Arguments

- `/ticket <feature>`, such as `/ticket deepening`: every open ticket in `.scratch/<feature>/issues/`. This is the default.
- `/ticket <feature> <NN>`, such as `/ticket deepening 08`: that ticket only.

`<feature>` is a folder name under `.scratch/`. If the argument names no folder, list the folders that have open tickets and ask the owner which one.

## The base flow

The flow is implement-spec, with the changes below. Read its SKILL.md first. It is the newest match of:

```
~/.claude/plugins/cache/mattpocock/mattpocock-skills/*/skills/engineering/implement-spec/SKILL.md
```

Follow its steps, with these changes. Where the two differ, this file wins.

- **`main` is the integration branch.** Each implementer lands its own ticket with `make land` as soon as it is done. Skip the merger subagent and the draft PR. This follows AGENTS.md: main moves ticket by ticket.
- **The implementer brief is `implementer.md`** in this skill's folder. Point each implementer at it. Do not paste its content.
- **Only `ready-for-agent` tickets join the run.** A ticket with any other open status stays out, and so does every ticket it blocks. List the left-out tickets for the owner at the start.
- **Ask before each new implementer once the 5-hour limit passes 80%.** Read the `fiveHour` field of `~/.local/state/claude-stats/$HC_TERMINAL_ID.json`. Below 80%, carry on without asking.
- **Build on Sonnet, review on Opus, fix on Sonnet.** Pass `model: "sonnet"` to each implementer and to the fix implementer. Pass `model: "opus"` to the code-review subagents.
- **The review covers the run's range:** from the `main` commit you recorded at the start to the tip of `main`.

## The run board

The pipeline panel draws the run from the board as one card, with one line per ticket. Write to it with `status.sh` in this skill's folder. Call it by this relative path, from your worktree root:

```sh
.claude/skills/ticket/status.sh start <feature> <NN>...            # once, with every ticket in the run
.claude/skills/ticket/status.sh phase <feature> "<what you do>"   # "building 3", "review", "fixing review", "done"
.claude/skills/ticket/status.sh set <feature> <NN> <state> "<note>"
.claude/skills/ticket/status.sh show <feature>
.claude/skills/ticket/status.sh end <feature>
```

The states are `queued`, `waiting`, `building`, `landing`, `landed`, `failed`, and `needs-you`. Implementers set `building` and `landing` themselves. You set the rest.

A note is at most 40 characters, such as "waits on 03" or "make check fails in reach.test.ts". The card shows it beside the ticket.

Your worktree's guard refuses `$(git …)` inside another command, `&&` chains with git, heredocs, and loops. Send one plain command per Bash call.

## Steps

### 1. Fix the run

Read the spec and every open ticket of the feature. Pick the tickets as the changes above say. Record the `main` commit with `git rev-parse main`. Run `status.sh start` with the picked ticket numbers. If it fails, another session leads this run. Tell the owner which worktree, then stop.

Set each ticket whose blockers are still open to `waiting`, with a note naming the blockers.

Done when the board lists every picked ticket, and the owner has the list of left-out tickets.

### 2. Build the frontier

For each ticket on the frontier, set it to `queued`, then start an implementer in the background. Use the Agent tool with `isolation: "worktree"` and `model: "sonnet"`, and this prompt, filled in:

```
Read .claude/skills/ticket/implementer.md and follow it.
Feature: <feature>
Ticket: <NN>, .scratch/<feature>/issues/<file>
Exploration notes: <path, or "none">
```

When an implementer reports, check `status.sh show <feature>` and `git log main`:

- **Landed**: set the ticket to `landed`. Set each ticket it unblocks to `queued` and start its implementer.
- **Not landed**: set the ticket to `failed`, with the reason as the note. Tell the owner what broke and what you suggest. Keep the rest of the frontier moving.

Keep the phase current, such as "building 3 · 2 landed".

Done when every ticket in the run is `landed` or `failed`, or waits only on failed tickets.

### 3. Review and fix

Set the phase to `review`. Run the code-review flow from implement-spec on the run's range. Then set the phase to `fixing review` and hand every finding to one fresh implementer, with the same brief. Name the findings file in its prompt, and use `fix` as its ticket number. Its board line shows as "fix".

Done when the fix has landed, or the review found nothing.

### 4. Close the run

Remove each implementer worktree with `git worktree remove <path>`, one per Bash call. Set the phase to `done`. Report to the owner:

- the tickets that landed, with their commits;
- the tickets that failed or stayed out, and why;
- the next unblocked ticket or spec, for a fresh session.

Run `status.sh end <feature>` only after the owner has read the report. The card stays on the panel until then.

Done when the owner has the report and the board no longer lists the run.
