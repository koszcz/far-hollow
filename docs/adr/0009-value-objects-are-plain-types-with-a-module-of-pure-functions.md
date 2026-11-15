# Value objects are plain types with a module of pure functions

A value object is a small value that is defined by what it holds, not by who it is. Two value objects that hold the same data are equal. Examples are a spot on the ground, the way a structure faces, or a set of material counts.

We write each value object as two things that live in one file:

- an immutable plain type, such as `type Facing = 0 | 1 | 2 | 3` or `interface GroundPoint { readonly x: number; readonly z: number }`
- pure functions beside it that own every rule about the value, such as turning it, comparing it, or converting it to radians

Callers use these functions. They do not repeat the arithmetic themselves. A function returns a new value. To change a component, the caller assigns the new value to it.

We chose this because the same small rules were written out again at each call site. For example, wrapping a facing past 3 back to 0 was written by hand in five places. When a rule lives in many places, the copies drift apart. With one module, a fix in one place fixes every caller, and the module is easy to test on its own.

We use plain types instead of classes because of ADR 0003. Entities hold plain data components that save and load as JSON. A class instance loses its methods when the game saves it.

## When to make a value object

Make one when you see either of these:

- The same calculation on a plain type appears in more than one file.
- A plain number or record has a rule that callers must remember, such as a range, a wrap-around, a unit, or "never below zero".

Leave hot loops, such as the pathfinding search, on raw numbers when creating new objects there would slow the game down.

## Considered options

- **Classes with methods**: rejected. Their instances do not survive saving to JSON, and they clash with the plain data components of ADR 0003.
- **Branded types that the compiler checks**: not chosen for now. They add type casts at every place a value is created. Add a brand only if a mix-up between two values of the same shape causes a real bug.
