import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The browser modules and the Express router are tested side by side, so
    // both trees are included explicitly.
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.js'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
});
