import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },
    server: {
        proxy: {
            // Proxy all API calls to the backend service
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },
        },
        watch: {
            usePolling: true
        },
    },
});
