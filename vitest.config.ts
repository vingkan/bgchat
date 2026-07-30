import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// jsdom globally so the same runner covers pure-engine unit tests AND
// React component tests. Engine tests don't need the DOM but it's harmless.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Playwright specs live in e2e/ and use their own runner — keep them out of Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
