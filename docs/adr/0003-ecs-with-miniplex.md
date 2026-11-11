# Game logic uses an entity-component-system built on miniplex

Game logic is organized as an entity-component-system (ECS). Every game object is an entity made of plain data components, and systems update those components on a fixed timestep. We use the `miniplex` library for the entity store. We chose an ECS because a survival game has many objects that share behaviors in mixed ways, such as trees, stumps, blueprints, animals, and fires. Plain data components are also easy to save, load, and test.

## Considered options

- **Class hierarchies (for example, a `Tree` class extending `Entity`)**: rejected. Shared behavior across unrelated objects leads to deep, fragile inheritance.
- **bitECS**: rejected. Its numeric arrays are faster but awkward for the varied data a building game stores.
