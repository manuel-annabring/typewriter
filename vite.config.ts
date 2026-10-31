import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the project site under /typewriter/, so the build needs that base path
// (code reads it through import.meta.env.BASE_URL), and `vite preview` must serve the build under
// it. The dev server stays at the root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/typewriter/' : '/',
  plugins: [react()],
}))
