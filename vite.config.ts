import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Carimbo de quando este build foi gerado (cada deploy = build novo)
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
