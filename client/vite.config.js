import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/jornadas': 'http://localhost:3000',
      '/standings': 'http://localhost:3000',
      '/teams.json': 'http://localhost:3000',
      '/resultados.json': 'http://localhost:3000',
    },
  },
})
