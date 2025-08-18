import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/supabase-functions': {
        target: 'https://mmltzetxcvdjxkizqrjz.supabase.co/functions/v1',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/supabase-functions/, ''),
      },
      '/api/justtcg': {
        target: 'https://api.justtcg.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/justtcg/, ''),
      },
      '/api/pokemontcg': {
        target: 'https://api.pokemontcg.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/pokemontcg/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
