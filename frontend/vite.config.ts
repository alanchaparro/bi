import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const cacheDir = process.env.VITE_CACHE_DIR || path.resolve(process.cwd(), 'node_modules', '.vite')

export default defineConfig({
  plugins: [react()],
  cacheDir,
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', '**/*.e2e.*'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
  },
})
