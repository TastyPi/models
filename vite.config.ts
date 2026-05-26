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
        'wall-hook': resolve(__dirname, 'wall-hook/index.html'),
        'gridfinity-baseplate': resolve(__dirname, 'gridfinity-baseplate/index.html'),
        'corner-radius-gauge': resolve(__dirname, 'corner-radius-gauge/index.html'),
        'gridfinity-bin': resolve(__dirname, 'gridfinity-bin/index.html'),
        'magnet-test': resolve(__dirname, 'magnet-test/index.html'),
        'dymo-letratag': resolve(__dirname, 'dymo-letratag/index.html'),
        'ltt-screwdriver-bin': resolve(__dirname, 'ltt-screwdriver-bin/index.html'),
        'pole-socket':         resolve(__dirname, 'pole-socket/index.html'),
        'aa-battery-bin':      resolve(__dirname, 'aa-battery-bin/index.html'),
      },
    },
  },
})
