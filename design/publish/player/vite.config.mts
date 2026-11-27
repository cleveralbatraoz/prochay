import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  envDir: false,
  publicDir: false,
  build: {
    target: 'es2022',
    license: { fileName: 'licenses.txt' },
  },
})
