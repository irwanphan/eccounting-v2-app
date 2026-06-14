import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/eccounting_v2',
  },
  schemaFilter: ['eccounting'],
  verbose: true,
  strict: true,
  introspect: {
    casing: 'preserve',
  },
});
