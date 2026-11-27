# Token economy: make ticket runs cheaper

A retro on the sessions from 2026-11-20 to 2026-11-27 found that implementer subagents use about 46% of this repo's token spend. Each one averages 71 turns, and its context grows to about 100k tokens. Most of that context is big source files pulled in with `sed -n` and `cat`, plus screenshots.

This spec makes each implementer cheaper in three ways:

1. Implementers run on Sonnet. Reviews run on Opus, and the fixes for review findings run on Sonnet.
2. The lint step caps file length, so the biggest modules stop growing. Splitting them comes later, in its own spec.
3. The implementer brief sends the agent to game state before screenshots.

## Tickets

- `issues/01-lean-implementer-runs.md`
