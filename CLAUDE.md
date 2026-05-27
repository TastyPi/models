# Project guidelines

## Tech stack

- **Framework**: SolidJS (JSX, fine-grained reactivity)
- **Build**: Vite + TypeScript
- **3D geometry**: manifold-3d (WebAssembly)
- **3D rendering**: Three.js
- **Package manager**: yarn (PnP) — always use `yarn`, not `npx` or bare binaries

## Commands

```bash
yarn dev          # start dev server at http://localhost:5173
yarn build        # type-check + production build
yarn test         # run unit tests (watch mode)
yarn test --run   # run unit tests once
```

## Architecture

Each model has four parts that must all be added together:

| File | Purpose |
|------|---------|
| `src/models/<slug>.ts` | Geometry definition using `defineModel` |
| `src/pages/<slug>.tsx` | SolidJS page component |
| `<slug>/index.html` | Entry HTML for the page |
| Entry in `src/models/registry.ts` | Model registry (slug, label, group) |
| Entry in `vite.config.ts` `build.rollupOptions.input` | Vite multi-page build |
| Entry in `src/components/IndexPage.tsx` `MODELS` array | Index page card (keep array sorted alphabetically by slug) |
| Entry in `src/workerShared.ts` `MODELS` record | Preview worker registration |

Model `generate()` functions use manifold-3d (WASM) and are not unit-tested directly. Pure utility functions (e.g. `src/screws.ts`) can be unit-tested without any special setup.

## Testing

- Test files live alongside source as `<name>.test.ts`
- **When fixing a bug or issue, always write a test that covers the fix**

## Verifying models

Models are 3D geometry rendered in the browser. To verify a model, ask the user to open the dev server URL and visually inspect it — do not attempt to use Playwright, headless browsers, or screenshot tools.

## Code style

- No comments unless the WHY is non-obvious
- Use CSS `:hover`/transitions for visual behaviour, not JS event handlers
