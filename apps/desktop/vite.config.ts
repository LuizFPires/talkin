import { defineConfig } from 'vite';

// Frontend da janela do Tauri. O backend nativo fica em src-tauri.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { outDir: 'dist', target: 'esnext' },
});
