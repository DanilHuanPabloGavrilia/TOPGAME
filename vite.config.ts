import { defineConfig } from 'vite';

export default defineConfig({
  // Yandex Games and VK serve a build from a hashed subdirectory, not from the host root.
  // Absolute '/assets/...' URLs 404 there, so every emitted path must stay relative.
  base: './',
  build: {
    // Keep art out of the JS bundle: inlined data URIs would block first paint.
    assetsInlineLimit: 0
  }
});
