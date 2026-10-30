import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { devApi } from './scripts/dev-api.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL('./apps/check', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), devApi({ ...loadEnv(mode, process.cwd(), ''), ...process.env })],
  build: {
    outDir: fileURLToPath(new URL('./dist/check', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
}))
