import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // 允许局域网访问 (手机扫码)
  },
  build: {
    outDir: 'dist',
  },
});
