import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/psx-world/',
  plugins: [react()],
  resolve: { dedupe: ['three'] },
});
