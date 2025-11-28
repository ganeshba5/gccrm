import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173, // Default Vite port
    strictPort: false, // Allow port fallback if 5173 is taken
  },
  preview: {
    host: '0.0.0.0', // Also allow network access for preview
    port: 4173, // Default Vite preview port
    strictPort: false,
  },
})
