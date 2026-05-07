# models

Parametric 3D-printable models, configurable in the browser and exported as STL.

**https://tastypi.github.io/models/**

## Licence

The source code is released under the [MIT licence](LICENSE).

The models themselves are released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — you're free to use, remix, and share them as long as you give credit.

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
