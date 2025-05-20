This contains the database schema for vector embeddings and concepts.
All CLI commands below should be run in this directory (`packages/database`.)

1. Setup
   1. Install [Docker](https://www.docker.com)
   2. Install the [supabase CLI](https://supabase.com/docs/guides/local-development). (There is a brew version)
   3. `supabase login` with your (account-specific) supabase access token. (TODO: Create a group access token.)
   4. `supabase link`. It will ask you for a project name, use `discourse-graphs`. (Production for now.) It will also ask you for the database password (See 1password.)
   5. Install [sqruff](https://github.com/quarylabs/sqruff)
2. Usage:
   1. Use `turbo dev`, (alias for `supabase start`) before you use your local database. URLs will be given for your local supabase database, api endpoint, etc.
   2. You may need to `supabase db pull` if changes are deployed while you work.
   3. End you work session with `npm run stop` (alias for `supabase end`) to free docker resources.
3. Development: We follow the supabase [Declarative Database Schema](https://supabase.com/docs/guides/local-development/declarative-database-schemas) process.
   1. Assuming you're working on a feature branch.
   2. Make changes to the schema, by editing files in `packages/database/supabase/schemas`
   3. If you created a new schema file, make sure to add it to `[db.migrations] schema_paths` in `packages/database/supabase/config.toml`. Schema files are applied in that order, you may need to be strategic in placing your file.
   4. `turbo build`, which will do the following:
      1. Check your logic with `sqruff lint supabase/schemas`, and eventually `sqruff fix supabase/schemas`
      2. Regenerate the types file with `supabase gen types typescript --local > types.gen.ts`
      3. See if there would be a migration to apply with `supabase db diff`
   5. If applying the new schema fails, repeat step 4
   6. If you are satisfied with the migration, create a migration file with `npm run dbdiff:save some_meaningful_migration_name`
      1. If all goes well, there should be a new file named `supbase/migration/2..._some_meaningful_migration_name.sql` which you should `git add`.
   10. You can start using your changes again `turbo dev`
   11. When your PR gets merged to main, deploy your changes to production with `supabase db push`. (URGENT TODO: make that a CI/CD step.)
