import { defineConfig } from 'vitest/config';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'livecam';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? `/${repositoryName}/` : '/',
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
