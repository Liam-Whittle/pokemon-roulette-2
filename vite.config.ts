import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` must match the GitHub Pages project path:
// https://liam-whittle.github.io/pokemon-roulette-2/
export default defineConfig({
  base: '/pokemon-roulette-2/',
  plugins: [react()],
})
