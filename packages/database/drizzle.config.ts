import { envContents } from '@repo/database/dbDotEnv';
import { defineConfig } from 'drizzle-kit';

const env = envContents();

export default defineConfig({
  schema: './src/drizzleSchema.ts', // Or wherever you want the generated schema to be
  // out: './src/drizzle', // Output directory for migrations (optional for pull)
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.SUPABASE_DB_URL!
  },
  verbose: true,
  strict: true,
  migrations: {
    prefix: "timestamp"
  },
  entities: {
    roles: {
      provider: 'supabase'
    }
  }
});
