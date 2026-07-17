import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ramble',
        short_name: 'Ramble',
        description: 'A creature-herding game set in Central Park\'s Ramble',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a1f16',
        theme_color: '#1a1f16',
        icons: [
          {
            src: 'manifest/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'manifest/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
