# models

Parametric 3D-printable models, configurable in the browser and exported as STL.

**https://tastypi.github.io/models/**

## Licence

Released under the [MIT licence](LICENSE).

## Development

```bash
yarn install
yarn dev
```

Open http://localhost:5173 to view the app.

### Adding a model

1. Create `src/models/<slug>.ts` implementing `defineModel`
2. Add it to `src/models/registry.ts`
3. Create `<slug>/index.html` and `src/pages/<slug>.tsx`
4. Add the entry to `vite.config.ts`
