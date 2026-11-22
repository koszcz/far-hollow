---
name: idea
description: Write the owner's idea down as an idea ticket, ready for a later grilling session, and land it on main.
disable-model-invocation: true
---

# Add an idea

The owner gives you an **idea**: a feature or a change they want some day, in a sentence or two. You write it down as one ticket with the status `idea`, then land it. A later grilling session answers its questions and makes it `ready-for-agent` (see `docs/agents/triage-labels.md`).

You record the idea. You leave the design to the grilling session, so write each open question down instead of answering it. Ask the owner something only when you cannot tell what the idea is.

## Arguments

`/idea <text>`, such as `/idea a smoking rack to keep fish longer`. Several ideas in one message give one ticket each.

## Steps

### 1. Find its home

Search `.scratch/` and `GLOSSARY.md` for the idea's words.

- If an open ticket already covers the idea, add the new detail to that ticket instead. Skip step 2.
- If the idea grows an existing feature folder, add the ticket there as the next number, such as `.scratch/clay/issues/05-<slug>.md`.
- Otherwise, start a new folder: `.scratch/<feature-slug>/issues/01-<slug>.md`.

Done when you have one file path, new or existing.

### 2. Write the ticket

Use this layout. Use the glossary's words for things the game already has.

```markdown
# NN: <Title: what the player can do or see>

**What to build:** <Two or three sentences in the owner's terms: what the player can do, and why it matters. Name the feature or ticket it builds on, if any.>

**Status:** idea

**Assets:** None yet. Decide during grilling. <Name catalogue assets from asset-manifest.json that might fit, if any.>

Questions for grilling:

- <An open design question the idea leaves.>
```

Add a `**Blocked by:** NN` line above the status only when the idea needs an open ticket first.

Write three to five questions. Good questions cover what it costs or needs, how the player uses it, how long things take, and how it fits what the game already has. Each question asks for a decision the grilling session must make.

Done when the file exists and has every part of the layout.

### 3. Land it

Commit the ticket, then run `make land` right away. Do not ask the owner first. If `make land` reports a merge conflict, resolve it, commit, and run `make land` again.

Done when `make land` reports that the branch is on main.

### 4. Report

Tell the owner the ticket's path and its title. Then stop.
