/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// dispatch.discordwell.com is a root host (not a subpath), so base '/'.
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    // Pure core/* logic runs in node — fast, no jsdom. The drag UI is wet-tested in a browser.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
