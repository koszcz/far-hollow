# The game says why it refuses a command, and the UI only shows it

The game logic decides whether the player can do something. The UI never decides this itself. Before the action menu lists an action, it asks the game client, `client.refusal(command)`, why the game would turn that command away. If the game gives a reason, the menu greys the action out and shows that reason. If it gives none, the action is allowed.

Each module that carries out a command also gives its refusal, such as `woodpiles.refusal` for stacking and taking wood. The game checks that refusal before it runs any command. A refused command does nothing, and a notice shows the reason. The module checks the same rule again, with the same function, when the player gets to the thing, because things can change while the player walks there. So one rule serves both the menu and the work.

Each kind of command has one rule. The activity module that carries out the command exports its rule, such as `woodpileRules` in `src/sim/woodpiles.ts`. `src/sim/command-rule.ts` defines the shape of a rule, and `commandRules` in `src/sim/game.ts` collects the rules of every module. The rule says whether the command stops what the player was doing, how to carry it out, why it is refused, and whether it needs free hands.

We chose this because the UI used to check the same rules again from the game view, such as whether a woodpile was full. When a rule changed in the game, the menu could still show an action as allowed, and the action then did nothing.

## Considered options

- **The game returns every action a thing offers, ready to show**: rejected. The order of actions, their labels, and which one is the main action are UI choices. They would pull UI wording and layout into the game logic.
- **The view carries a flag for each rule, such as whether a campfire can be lit**: rejected. That was the old design. Every new rule needed a new flag, and the UI still had to combine the flags itself.
