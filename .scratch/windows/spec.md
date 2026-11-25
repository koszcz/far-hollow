# Windows: spec

A room today is a log box with a door. This feature adds the **window**, an edge piece with an opening and no glass, and the **shutters** that hang in it. Open shutters let daylight in. Closed shutters keep the room snug. The player chooses between light and warmth.

## Goals

- Give a cabin light by day without giving up the snug bonus for good.
- Reuse the door frame and door pattern, so windows add no new kind of building rule.

## Building a window

- A window is an edge piece of its own, like the door frame. The player places it on an empty edge of a finished foundation square.
- It costs 3 debarked logs and takes 10 seconds to build, like a door frame. It needs no tool beyond what a log wall needs.
- It blocks walking like a log wall. It counts as a closed side of a room, and it holds up a roof frame like a log wall.
- The door frame's corner rule applies: a window cannot meet a log wall, door frame, or window at a right angle at a corner.
- The player can build a window wherever a log wall can go.
- A window cannot replace a finished log wall. To put a window where a wall stands, the player takes the wall down first.

## Shutters

- Shutters are a building piece that hangs in a finished window, the way a door hangs in a door frame.
- They cost 2 planks and take 4 seconds to build.
- Finished shutters start closed. The player opens and closes them by hand with the main action, "Open shutters" or "Close shutters". Nothing opens or closes them on its own.
- Shutters swing on their hinges as they open and close.

## Snug rooms

- A room is snug only when every window in it has closed shutters, as well as a floor on every square and a door in every door frame.
- A window with open shutters, or with no shutters, stops the room from being snug.

## Rain

- Rain never falls indoors. A window with open shutters lets no rain in.

## Taking down

- Shutters come down on their own and give back their planks.
- A window with shutters, finished or as a blueprint, cannot come down. The refusal says to take the shutters down first.
- A window gives back its debarked logs.

## Light

- A roof that hides over the player still casts its shadow, and so does its roof frame. A room is dark by day except where daylight comes in through an open window or a doorway.
- This changes the look of every existing cabin. The owner approved the change to the approved `roof`, `roof-frame`, and `roof-corners` assets on 2026-11-22.
- At night, an open window shows a warm glow from outside when a lit campfire, fireplace, or torch is in the room. Closed shutters show no glow. The glow has no effect on play.

## Saving

- A window and its shutters are saved with the shutters' state, open or closed. The save version goes up, and older saves are upgraded when loaded.

## Assets

| Asset | What it is |
| --- | --- |
| `window` | Draft. A log wall with an opening, built in courses like the log wall |
| `shutters` | Draft. Two plank shutters on hinges, open or closed |
| `shutter-swing` | Draft. The shutters swinging open and closed |
| `window-icons` | Draft. Build menu icons for the window and the shutters |
| `window-glow` | Draft. The warm glow in an open window at night |
| `roof`, `roof-frame`, `roof-corners` | Approved. They keep casting shadows while hidden over the player. Change approved by the owner on 2026-11-22 |

`floor-and-door-icons` is a draft but belongs to another feature, so the window icons get their own draft entry. Nothing comes from third-party packs.

## Tickets

1. Build a window and hang shutters that open and close.
2. Indoor shadow and the window's night glow. Blocked by 01.

## Not in this feature

- Glass
- Turning a finished log wall into a window or door frame without taking it down
- Shutters that open or close on their own
- Rain or cold coming in through an open window
- A journal goal for windows
