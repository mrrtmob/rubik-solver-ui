# rubik-solver — Example App

A fully working Rubik's Cube solver web app demonstrating how to use the [`rubik-solver`](https://github.com/mrrtmob/rubik-solver) npm library via CDN — no build step required.

## Live Demo

[Demo](https://rubik-solver-ui.vercel.app/)

Open `index.html` in any modern browser (or serve it with a local server).

```bash
npx serve .
```

## What This Demonstrates

This app shows real-world usage of the `rubik-solver` package:

```js
import('https://esm.sh/rubik-solver').then(module => {
  const { Cube, initSolver, solve, scramble } = module;

  // Pre-compute solver tables (one-time, ~1-2s)
  initSolver();

  // Solve a scrambled cube
  const cube = new Cube().move("R U R' U'");
  const solution = solve(cube);   // e.g. "U R U' R'"

  // Verify a cube state before solving
  const result = cube.verify();
  if (result !== true) {
    console.error(result); // describes the exact problem
  }

  // Generate a random scramble
  const scr = scramble();         // e.g. "D2 L F2 R' U ..."
});
```

## Features

- **Paint mode** — click any facelet and paint it with a color to describe a physical cube
- **Scramble** — type or generate a random scramble algorithm
- **Solve** — find the optimal solution using Kociemba's two-phase algorithm
- **Verify** — invalid cube states are caught and described clearly before solving
- **Playback** — step through the solution move by move with animated 3D visualization
- **Facelet string** — import/export the 54-char cube state string

## Project Structure

```
rubik-app/
├── index.html          ← HTML layout and script imports
├── css/
│   └── style.css       ← All styles
└── js/
    ├── app.js          ← Main app logic, state, solver integration
    ├── ui.js           ← DOM helpers (palette, face net, solution box)
    └── three-cube.js   ← Three.js 3D cube renderer and move animations
```

## Dependencies

| Package                                                     | Purpose             | How loaded                      |
| ----------------------------------------------------------- | ------------------- | ------------------------------- |
| [`rubik-solver`](https://www.npmjs.com/package/rubik-solver) | Cube solving engine | `esm.sh` CDN (dynamic import) |
| [Three.js r128](https://threejs.org/)                          | 3D rendering        | `cdnjs` CDN script tag        |

No bundler, no build step — just open in a browser.

## rubik-solver API Used

```ts
// Create a solved cube
const cube = new Cube();

// Apply moves
cube.move("R U R' U'");

// Check if solved
cube.isSolved(); // boolean

// Validate a user-provided state
cube.verify(); // true | string (error message)

// Get the 54-char facelet string
cube.asString();

// Parse from facelet string
Cube.fromString("UUUUUUUUU...");

// Invert an algorithm
Cube.inverse("R U R' U'"); // "U R U' R'"

// Generate a random scramble string
scramble();

// Solve (returns move string or null)
solve(cube, 22);
```

## Library

The solver engine lives at:

- **npm**: [rubik-solver](https://www.npmjs.com/package/rubik-solver)
- **GitHub**: [mrrtmob/rubik-solver](https://github.com/mrrtmob/rubik-solver)

## License

MIT
