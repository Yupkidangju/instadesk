import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/instadesk/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      // 로컬 개발 시 CORS 우회를 위한 내장 프록시
      // 브라우저에서 /instabox-api/... 로 요청하면 https://api.instabox.sh/... 로 포워딩하며
      // Origin: https://dashboard.instabox.sh 헤더를 자동 주입
      '/instabox-api': {
        target: 'https://api.instabox.sh',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/instabox-api/, ''),
        headers: {
          Origin: 'https://dashboard.instabox.sh',
          Referer: 'https://dashboard.instabox.sh/',
        },
        ws: true,
      },
      // 데스크톱 스트림 접속용 프록시 (필요시)
      '/instabox-connect': {
        target: 'https://connect.instabox.sh',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/instabox-connect/, ''),
        headers: {
          Origin: 'https://dashboard.instabox.sh',
        },
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
