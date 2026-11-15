# Hunting: spec

The player's only cooked food is fish. This feature adds meat, and two ways to get it. A **snare** catches rabbits while the player does other work. A **bow** lets the player hunt the deer that now live in the valley.

Terms in **bold** are defined in `GLOSSARY.md`. The game design spec in `.scratch/first-playable/spec.md` still applies, including its frame-rate targets.

## Goals

- The player has a second source of cooked food, away from the river.
- The snare rewards planning: set it, leave it, and come back.
- The bow rewards care: walk up slowly and shoot from close.
- The valley has animals in it.

## Cord

- **Cord** is a new material, twisted from bark. It is a **hand recipe**: 3 bark make 1 cord. It needs no tool.
- A cord weighs 0.1 kg. It can be dropped and stored like other small materials.

## Meat

- **Raw meat** and **cooked meat** are new foods. Each weighs 0.5 kg.
- The player cooks raw meat on a lit fire the way they cook raw fish. Meat and fish share the 3 places on a fire.
- Meat takes the same time to cook as fish.
- Raw meat fills hunger as much as raw fish, and gives the same **sickness**.
- Cooked meat fills hunger as much as cooked fish. It never burns.
- Meat never rots.
- Both can be dropped, form **piles**, and can go in a **chest** or on a **shelf**.

## Snare

- The snare is a hand recipe: 1 cord and 2 sticks. It needs the knife.
- A snare weighs 0.5 kg. The player carries it in the backpack.
- "Set" is the **main action** of a snare in the backpack. It sets the snare on the ground at the player's feet.
- A snare can be set only on **forest floor** or in a **clearing**, at least 10 m from any other set snare and at least 15 m from any structure.
- A set snare catches a rabbit after 6 to 12 game hours. The time is drawn again after each catch.
- A snare holds one rabbit. It catches nothing more until the player empties it.
- A set snare shows whether it holds a rabbit.
- "Take rabbit" is the main action of a snare that holds one. It needs the knife. It puts 2 raw meat in the backpack. The snare stays set.
- "Pick up" puts an empty set snare back in the backpack.
- A set snare does not block walking.
- Rabbits are not shown running in the valley.

## Deer

- Deer live in the valley. A valley holds up to 6 deer.
- Deer graze in **clearings** and wander slowly between them. They keep away from structures and lit fires.
- A deer notices the player within 12 m, or within 20 m if the player is carrying a lit torch or dragging a sled.
- A deer that notices the player runs to a spot at least 40 m away. It runs faster than the player.
- Deer do not cross the river and do not enter foundations.
- When a deer is killed, a new deer walks into the valley from its edge 2 days later.
- The same seed puts the first deer in the same places.

## Bow and arrows

- The bow is a hand recipe: 2 sticks and 1 cord. It needs the knife. It is a **tool**, and weighs 0.8 kg.
- Arrows are a hand recipe: 1 stick makes 2 arrows. It needs the knife. An arrow weighs 0.1 kg.
- "Shoot" is the main action of a deer when the player has the bow and an arrow. The player must be within 25 m and have a clear line to the deer.
- The player draws for 2 seconds, then shoots. Drawing does not move the player.
- A shot hits more often from close. It always hits within 8 m, and hits half the time at 25 m.
- A hit kills the deer. A miss makes the deer run.
- Every shot uses up the arrow.
- A killed deer lies where it fell. "Butcher" is its main action. It needs the knife and takes 10 seconds of held work.
- Butchering gives 8 raw meat. Meat that does not fit in the backpack drops in a pile beside the deer.
- A killed deer that is not butchered is gone after 1 day.

## Saving

- Cord, meat, snares in the backpack, set snares with their time to the next catch, the bow, and arrows are saved.
- Deer, where each one is, killed deer, and the time until each new deer arrives are saved.
- The meat on each fire is saved, with its progress.
- The save version goes up. Older saves are upgraded when loaded.

## Assets

All new assets go in as drafts built in code. The owner approves or changes them later with the `make-asset` skill. See ADR 0006.

| Catalogue entry | What it is |
| --- | --- |
| `hunting-icons` | Backpack and craft menu icons for cord, raw meat, cooked meat, the snare, the bow, and the arrow |
| `hunting-piles` | How cord, meat, the snare, the bow, and arrows look lying on the ground |
| `snare` | A set snare, empty and holding a rabbit |
| `meat-on-fire` | Up to 3 pieces of meat on sticks over a fire. They darken as they cook. |
| `deer` | A deer, standing and lying killed |
| `deer-animations` | The deer grazes, walks, runs, and falls |
| `bow` | The bow in the player's hands |
| `bow-animation` | The player draws the bow and shoots |
| `butcher-animation` | The player kneels and works with the knife |

`backpack-icons`, `crafting-icons`, `pile`, and `fish-on-fire` are approved assets. So the new icons, piles, and the meat on a fire go in their own draft entries.

## Tickets

1. Twist cord, set a snare, and take raw meat from it.
2. Cook meat on a fire. Blocked by 01.
3. Deer live in the valley and run from the player.
4. Make a bow and arrows, shoot a deer, and butcher it. Blocked by 01 and 03.

## Later

- Rabbits the player can see.
- Hides, and things made from them.
- Arrows the player finds again after a miss.
- Deer that eat berries or saplings.

## Not in this feature

- Animals that harm the player
- Food that rots, and drying or smoking meat
- Aiming by hand
- Bait
