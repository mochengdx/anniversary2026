import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // 支持相对路径部署，用于部署在子目录如 /h5
  server: {
    port: 5173,
    host: true, // 允许局域网访问 (手机扫码)
  },
  build: {
    outDir: 'dist',
  },
});
