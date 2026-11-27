import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { frameRuntime } from './node_modules/doop/src/frame-runtime/vitePlugin.ts'

const staticView = fileURLToPath(new URL('./static-view.ts', import.meta.url))

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'disable-doop-hotspot-hints',
      enforce: 'pre',
      transform: {
        filter: { id: /\/doop\/src\/components\/PrototypePlayer\.tsx$/ },
        handler(source) {
          const message = "{ type: 'doop:proto', on: interactive, reqId }"
          if (!source.includes(message)) this.error('Doop prototype activation message has changed')
          return source.replace(message, "{ type: 'doop:proto', on: interactive, hints: false, reqId }")
        },
      },
    },
    react(),
    tailwindcss(),
    frameRuntime(),
  ],
  resolve: {
    alias: {
      './PrototypeComments': staticView,
      './pdfImport': staticView,
      './posthog': staticView,
      '../lib/posthog': staticView,
      '@': fileURLToPath(new URL('./node_modules/doop/src', import.meta.url)),
    },
  },
  envDir: false,
  publicDir: false,
  build: {
    target: 'es2022',
    license: { fileName: 'licenses.txt' },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'vendor', test: /\/node_modules\/(?!doop\/)/ }],
        },
      },
    },
  },
})
