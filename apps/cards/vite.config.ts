import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/trip_planner/cards/',
  build: {
    outDir: '../../dist/cards',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@trip-planner/core': path.resolve(__dirname, '../../packages/core/src'),
      '@trip-planner/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
