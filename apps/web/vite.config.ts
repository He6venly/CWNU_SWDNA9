import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../check/src', import.meta.url)), fileURLToPath(new URL('../../contract', import.meta.url)), fileURLToPath(new URL('../../changgo-icons', import.meta.url))] },
    proxy: { '/api': { target: 'http://127.0.0.1:5173', changeOrigin: true, headers: { origin: 'http://127.0.0.1:5173' } } },
  },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
