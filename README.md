# models

Parametric 3D-printable models, configurable in the browser and exported as STL.

**https://tastypi.github.io/models/**

## Licence

The source code is released under the [MIT licence](LICENSE).
Generated 3D model designs are released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Attribution

Some models are derived from or inspired by third-party open-source projects:

- **[Gridfinity](https://gridfinity.xyz/)** by Zachary Freedman / Voidstar Lab LLC — the Gridfinity specification (MIT)
- **[gridfinity-rebuilt-openscad](https://github.com/kennetek/gridfinity-rebuilt-openscad)** by Kenneth Hodson — baseplate profile geometry (MIT)
- **[GridFlock](https://github.com/yawkat/GridFlock)** by Jonas Konrad — edge puzzle connector design (MIT, CC BY 4.0)

## Development

```bash
yarn install
yarn dev    # http://localhost:5173
yarn test   # unit tests
yarn build  # production build
```

### Adding a model

1. Create `src/models/<slug>.ts` implementing `defineModel`
2. Add it to `src/models/registry.ts`
3. Create `<slug>/index.html` and `src/pages/<slug>.tsx`
4. Add the entry to `vite.config.ts`
