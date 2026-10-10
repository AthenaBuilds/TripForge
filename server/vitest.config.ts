import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Always the test database, never whatever DATABASE_URL happens to be in the shell:
// the test setup truncates every table. CI's Postgres service uses the same credentials.
export const testEnv = parse(readFileSync(new URL('.env.test', import.meta.url)));

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Integration tests share one database, so run test files one at a time.
    fileParallelism: false,
  },
});
