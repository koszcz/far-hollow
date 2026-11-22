---
name: grill
description: Grill the owner on one idea ticket, with docs, until it is ready-for-agent, then land it on main.
disable-model-invocation: true
---

# Grill an idea

You turn one `idea` ticket into work an agent can build. This is grill-with-docs, tied to this repo's tickets: you interview the owner, update the docs as decisions land, write the outcome into the tracker as `ready-for-agent` tickets, and land it.

## Arguments

- `/grill <path>`, such as `/grill .scratch/windows/issues/01-windows-with-shutters.md`: that ticket.
- `/grill <feature>`, such as `/grill windows`: the feature's `idea` tickets, one at a time.
- `/grill` alone: list every unblocked `idea` ticket under `.scratch/` and ask the owner which one.

## Steps

### 1. Load the ticket

Read the ticket, its feature's `spec.md` if there is one, and the glossary terms it uses. Its "Questions for grilling" are the first branches of the design tree. They are a start, not the whole tree.

Done when you know what the idea is and which parts of the game it touches.

### 2. Grill with docs

Call the Skill tool twice, for `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`, and follow both. As each term or decision settles, update `GLOSSARY.md` or add an ADR under `docs/adr/`, as domain-modeling says.

Settle the assets too. For each asset the idea needs, decide with the owner whether to reuse a catalogue entry or add a draft (see `AGENTS.md`, Assets). Changing an approved asset needs the owner's explicit approval. Record it on the ticket's `**Assets:**` line with the date.

Done when the grilling frontier is empty and the owner confirms you share an understanding.

### 3. Write it up

Choose by size:

- **One session of work**: rewrite the idea ticket in place. Replace "Questions for grilling" with checkbox acceptance criteria, grouped under headings when there are many. Fill in the `**Assets:**` line. `.scratch/fish-trap/issues/01-fish-trap.md` is a good model.
- **More than one session**: write `.scratch/<feature>/spec.md` and split it into tickets. Follow the newest `to-spec` and `to-tickets` SKILL.md files under `~/.claude/plugins/cache/mattpocock/mattpocock-skills/*/skills/engineering/`. The idea ticket becomes ticket `01` or gives way to the new tickets. Each ticket keeps the layout in `docs/agents/issue-tracker.md`, with its `**Blocked by:**` and `**Assets:**` lines.

Set every settled ticket to `ready-for-agent`. A ticket that still waits on the owner, such as for an asset approval, stays `idea`. Its "Questions for grilling" then name exactly what it waits on.

Done when every ticket of the idea has acceptance criteria and a status.

### 4. Land it

Commit, then run `make land` right away. Do not ask the owner first. If `make land` reports a merge conflict, resolve it, commit, and run `make land` again.

Done when `make land` reports that the branch is on main.

### 5. Report

Tell the owner:

- the tickets now `ready-for-agent`, and any left as `idea` with what they wait on;
- the glossary terms and ADRs you added;
- the first unblocked ticket, for a fresh session.

Then stop.
