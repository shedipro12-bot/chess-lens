import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Relative base so the site works on GitHub Pages (username.github.io/repo-name/) or any host.
export default defineConfig({ plugins: [react()], base: './' });
