import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Für die claude.ai-Version (VITE_STATIC ohne VITE_REMOTE_IMAGES) muss alles in EINE Datei:
// dynamische Imports (z. B. der Barcode-Leser) werden dann mit eingebettet.
const singleFile = !!process.env.VITE_STATIC && !process.env.VITE_REMOTE_IMAGES

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: singleFile ? { output: { inlineDynamicImports: true } } : {},
  },
})
