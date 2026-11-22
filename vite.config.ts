import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { assetEditor } from './tools/assetEditor.ts';

export default defineConfig({
  base: '/psx-world/',
  // assetEditor tags shapes and serves the dev-only asset editor's endpoints; it never runs in a build
  plugins: [assetEditor(), react()],
  resolve: { dedupe: ['three'] },
});
