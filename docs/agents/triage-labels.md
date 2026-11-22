# Ticket statuses

This repo has no triage step. An open ticket is in one of two states:

- `idea`: the owner wrote it down. It needs a grilling session before anyone builds it.
- `ready-for-agent`: a grilling session settled it. An agent can build it without asking anything.

Each issue file records its state on a `Status:` line.

## All statuses

| Status            | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `idea`            | Needs grilling. List the open questions under "Questions for grilling". |
| `ready-for-agent` | Grilled and fully specified. An agent builds it.                     |
| `deferred`        | Wanted, but not now. Skip it until the owner sets it back to `idea`. |
| `wontfix`         | Will not be built.                                                   |
| `resolved`        | Built and landed on `main`.                                          |

## How the skills' labels map to these statuses

The mattpocock skills speak of five triage labels. Use this table when a skill names one.

| Label in the skills | Status in this repo |
| ------------------- | ------------------- |
| `needs-triage`      | `idea`              |
| `needs-info`        | `idea`              |
| `ready-for-agent`   | `ready-for-agent`   |
| `ready-for-human`   | `ready-for-agent`. Every grilled ticket goes to an agent. |
| `wontfix`           | `wontfix`           |

## Rules

- Never ask the owner to triage a ticket. Never set a status other than the ones above.
- A new ticket the owner adds as a bare idea gets `idea`. The `/idea` skill writes one in the standard layout.
- The `/grill` skill runs a grilling session. It ends with each ticket it settled set to `ready-for-agent`. When grilling turns one idea into a spec with several tickets, every new ticket gets `ready-for-agent`.
- A ticket that still has open questions stays `idea`. Do not invent the answers.
- When you finish building a ticket, set it to `resolved`. The wayfinding operations in `issue-tracker.md` use the same word.
