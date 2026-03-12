import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react'
          }

          if (
            id.includes('/firebase/') ||
            id.includes('/@firebase/') ||
            id.includes('/idb/')
          ) {
            return 'vendor-firebase'
          }

          if (id.includes('/zustand/')) {
            return 'vendor-state'
          }

          return undefined
        }
      }
    }
  },
  plugins: [react()],
})
