import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const target = process.env.API_URL ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin proxy so the httpOnly session cookie reaches both REST and WebSocket.
    proxy: {
      '/api': { target },
      '/collab': { target: target.replace(/^http/, 'ws'), ws: true },
    },
  },
});
