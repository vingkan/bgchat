import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the static build works from any path, including a GitHub Pages
// project subpath (e.g. /bgchat/) without hardcoding the repo name.
// https://vite.dev/config/
export default defineConfig({
  base: '/bgchat/',
  plugins: [react()],
})
