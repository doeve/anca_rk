import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
console.log(env.JSONBIN_MASTER_KEY);
  return {
    define: {
      'process.env.JSONBIN_MASTER_KEY': JSON.stringify(env.JSONBIN_MASTER_KEY),
      'process.env.JSONBIN_BIN_ID': JSON.stringify(env.JSONBIN_BIN_ID),
      'process.env.ADMIN_PASSPHRASE': JSON.stringify(env.ADMIN_PASSPHRASE || 'admin'), // Default passphrase
      'process.env.TINYMCE_API_KEY': JSON.stringify(env.TINYMCE_API_KEY || 'admin'),
    },
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});