# Plain three.js, with game logic kept apart from rendering

We use TypeScript, Vite, and plain three.js instead of React Three Fiber. Game logic lives in its own layer that does not import three.js, and the rendering layer only reads that state. We chose this so the game logic can be tested without a browser, and so code quality and static checks stay strict as the game grows.

## Considered options

- **React Three Fiber**: rejected. It ties game state to React's render cycle, which makes a long-running simulation harder to test and reason about.
