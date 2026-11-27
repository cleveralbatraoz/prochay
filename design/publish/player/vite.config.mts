import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { frameRuntime } from './upstream/src/frame-runtime/vitePlugin.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), frameRuntime()],
  resolve: { alias: { '@': fileURLToPath(new URL('./upstream/src', import.meta.url)) } },
  envDir: false,
  publicDir: false,
  build: { target: 'es2022', license: { fileName: 'licenses.txt' } },
})
