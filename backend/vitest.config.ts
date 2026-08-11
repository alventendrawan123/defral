import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['agent/test/**/*.test.ts', 'backend/**/*.test.ts'],
    globals: false,
  },
});
