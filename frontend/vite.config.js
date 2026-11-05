import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Next.js backend runs on :3001; the dev server proxies /api to it
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
