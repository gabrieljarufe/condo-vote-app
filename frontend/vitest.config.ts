import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: { lines: 50, branches: 40, functions: 50, statements: 50 },
      exclude: ['**/*.config.*', '**/main.ts', '**/environments/**', '**/*.routes.ts']
    }
  }
});
