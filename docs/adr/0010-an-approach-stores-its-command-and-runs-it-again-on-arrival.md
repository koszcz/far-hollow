# An approach stores its command and runs it again on arrival

When the player must walk to a thing before acting on it, the game saves an approach. The approach holds the thing's id, or an exact spot, and the original `Command` the player sent. When the player arrives, the game runs that command's rule again. The rule checks its refusal first, as for any command. The player now stands within reach, so the rule acts instead of walking.

We chose this because commands are already plain data, so saves can hold them with no new schema. It also means the check on arrival uses the same refusal as the action menu, as ADR 0008 asks. A thing that changed while the player walked, such as a bed someone took down, is refused for the same reason the menu would give.

## Considered options

- **Each activity declares its own list of arrival kinds**: rejected. Each kind would need its own save check, the same mirroring that the approach module exists to remove.
- **Each activity keeps its own task component**: rejected. That was the old design. About 20 copies of the same walk and reach check drifted apart.

## Consequences

- An approach saved in an older game must hold a command that the current game still understands. A save upgrade turns older task components into approaches.
- A command's rule must be safe to run twice: once to start the approach and once on arrival.
