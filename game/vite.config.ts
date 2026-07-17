import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves a project site under /<repo>/, so production builds need
// that base path. Override with VITE_BASE (e.g. "/" for a custom domain).
export default defineConfig(({ command }) => {
  const base = process.env.VITE_BASE ?? (command === 'build' ? '/kodama/' : '/');
  return {
    base,
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Ramble',
          short_name: 'Ramble',
          description: "A creature-herding game set in Central Park's Ramble",
          id: base,
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#1a1f16',
          theme_color: '#1a1f16',
          icons: [
            { src: 'manifest/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'manifest/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
  };
});
