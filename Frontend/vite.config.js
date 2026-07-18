import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'



// https://vite.dev/config/
export default defineConfig({
  // Web (Vercel) needs an absolute base so assets resolve from the domain root
  // on nested routes like /invoice/public/:token. The Tauri desktop build loads
  // assets from a custom protocol and needs a relative base — Tauri sets
  // TAURI_ENV_PLATFORM during its build, so switch on that.
  base: process.env.TAURI_ENV_PLATFORM ? './' : '/',
  server: {
    port: 5175,
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Split the rarely-changing framework libs into their own chunk. They
        // stay byte-identical across app deploys, so the browser serves them
        // from cache on repeat visits instead of re-downloading the main bundle.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
