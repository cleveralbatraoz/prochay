import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  envDir: false,
  publicDir: false,
  build: {
    assetsInlineLimit: 0,
    target: 'es2022',
  },
})
