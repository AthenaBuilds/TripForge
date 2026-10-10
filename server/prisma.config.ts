import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // `prisma generate` doesn't need a database, so don't fail when DATABASE_URL is unset.
    url: process.env.DATABASE_URL ?? '',
  },
});
