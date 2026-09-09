import { defineConfig } from 'vite';
import { musicCatalogPlugin } from './build/musicCatalog.js';

// Relative assets also work under /hopalong-immersive/ on GitHub Pages.
export default defineConfig({ base: './', plugins: [musicCatalogPlugin()] });
