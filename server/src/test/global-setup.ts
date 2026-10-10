import { execSync } from 'node:child_process';
import { testEnv } from '../../vitest.config.js';

// Bring the test database up to the latest migration before any test runs.
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testEnv.DATABASE_URL },
  });
}
