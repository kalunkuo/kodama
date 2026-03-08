import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: false,
    host: true
  },
  build: {
    target: 'es2020'
  }
});
