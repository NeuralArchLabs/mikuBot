import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3001,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/scheduler-tasks.json', '**/scheduler-logs.json', '**/config.json', '**/sessions/**']
      }
    },
    base: './',
    plugins: [
      tailwindcss(),
      react()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('mermaid')) {
                return 'mermaid';
              }
              if (id.includes('@fortawesome')) {
                return 'fontawesome';
              }
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
