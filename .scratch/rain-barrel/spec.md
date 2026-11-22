# Rain barrel: spec

Rain only chills the player today. This feature adds the **rain barrel**, a piece of furniture that catches rain as **clean water**. The player drinks from it, or fills the pot from it, with no boiling. Rain then helps the player as well as chilling them.

## Goals

- Give the player a second source of clean water that needs no fire.
- Make rain worth something.
- Keep the river useful: a barrel fills slowly and runs dry in a long dry spell.

## Building a rain barrel

- The rain barrel is furniture. It is placed freely and does not snap to the grid.
- It costs 6 planks, needs the axe, and takes 10 seconds to build. It needs no work station.
- Taking it down gives back its planks. Its water spills.

## Catching rain

- A barrel holds up to 6 drinks of clean water. A drink is the water that fills thirst completely.
- It fills by 1 drink for every 2 game hours that rain falls on it. Partial progress carries over from one spell of rain to the next.
- A barrel catches rain only where rain would fall on the player. Under a roof it catches nothing. Water does not run off a roof into it.
- Its water never goes bad.

## Using the water

- "Drink" is the main action of a barrel that holds water. It fills thirst and takes out 1 drink.
- "Fill pot" turns the empty pot in the backpack into a pot of clean water and takes out 1 drink.
- The pot has one name for safe water, whether it was boiled or came from a barrel: "Pot of clean water".
- "Fill jug" pours 1 drink from the barrel into the fullest jug that has room. It waits on the jug (clay ticket 04).

## Saving

- A barrel is saved with its drinks and its progress toward the next drink. The save version goes up, and older saves are upgraded when loaded.

## Assets

| Asset | What it is |
| --- | --- |
| `rain-barrel` | Draft. Plank staves held by two hoops, open on top, with a water surface that rises with the drinks it holds |
| `rain-barrel-icon` | Draft. The build menu icon |

`furniture-icons` is an approved asset, so the build menu icon goes in its own draft entry. Nothing comes from third-party packs.

## Tickets

1. Build a rain barrel, catch rain, and drink or fill the pot from it.
2. Fill a jug from a rain barrel. Blocked by 01 and clay 04.

## Not in this feature

- Water running off a roof into a barrel
- Water going bad, freezing, or evaporating
- Filling the pot or a jug with unboiled river water from the barrel. Barrel water is always clean.
- Watering plants
- A journal goal for the barrel
