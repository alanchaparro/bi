import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const cacheDir = process.env.VITE_CACHE_DIR || path.resolve(process.cwd(), 'node_modules', '.vite')

export default defineConfig({
  plugins: [react()],
  cacheDir,
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom',
  },
})
