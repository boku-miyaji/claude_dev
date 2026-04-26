import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    copyPublicDir: true,
  },
  // Remote SSH / devcontainer 経由でアクセスできるよう全 interface で listen
  // localhost のみだとコンテナ外部（ホストの Mac）から届かず真っ白になる
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
