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
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom']
          }
        }
      }
    }
  };
});
