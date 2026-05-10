import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { resolve } from 'path'

export default defineConfig({
  base: '/models/',
  plugins: [solid()],
  optimizeDeps: {
    exclude: ['manifold-3d'],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'gridfinity-baseplate': resolve(__dirname, 'gridfinity-baseplate/index.html'),
        'corner-radius-gauge': resolve(__dirname, 'corner-radius-gauge/index.html'),
      },
    },
  },
})
