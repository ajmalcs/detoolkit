import { defineConfig } from 'vite' // force restart
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/detoolkit/',
  plugins: [react()],
})
