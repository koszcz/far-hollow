# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |
| (none)                     | `deferred`           | Wanted, but not now. Skip it until the owner brings it back to `needs-triage` |
| (none)                     | `resolved`           | Work is done and committed               |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

The skills have no role for finished work. When you finish an issue, set its `Status:` line to `resolved`. The wayfinding operations in `issue-tracker.md` use the same word.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
