import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Migrations need a direct (non-pooled) connection; Neon's pooled DATABASE_URL goes through PgBouncer.
    // `prisma generate` doesn't need a database, so don't fail when neither is set.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
