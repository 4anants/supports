import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    cacheDir: '../node_modules/.vite',
    build: {
        outDir: '../client',
        emptyOutDir: true
    },
    server: {
        port: 3002,
        host: true, // Allow external IPs to access the frontend
        proxy: {
            '/api': {
                target: 'http://localhost:3003',
                changeOrigin: true
            },
            '/uploads': {
                target: 'http://localhost:3003',
                changeOrigin: true
            }
        }
    }
})
