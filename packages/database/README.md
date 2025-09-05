This contains the database schema for vector embeddings and concepts.

There are four usage scenarios:

## Developing without the database

Your frontend will not use the database.
Optional: Set `SUPABASE_USE_DB=none` in your console before running `turbo dev`. (This is now the default.)

## Local development setup

Normal scenario: Your backend and frontend will work against a database instance within docker.
It does mean you will have a fresh database with minimal data.
Set `SUPABASE_USE_DB=local` in your console before running `turbo dev`.

### Installation

1. Install [Docker](https://www.docker.com)
2. Set the `SUPABASE_WORKDIR` in your environment to the absolute path of the `packages/database` directory.
3. Install [sqruff](https://github.com/quarylabs/sqruff), version >= 0.29.1

### General usage:

1. `turbo dev`, will do a `supabase start` so you can talk to your local database.
2. You can use the Supabase studio to look over things; its url is given by the database section of `supabase start`.
3. End your work session with `supabase end` to free docker resources.

### Database-specific development

We follow the Supabase [Declarative Database Schema](https://supabase.com/docs/guides/local-development/declarative-database-schemas) process.

1. Assuming you're working on a feature branch.
2. Make changes to the schema, by editing files in `packages/database/supabase/schemas`
3. If you created a new schema file, make sure to add it to `[db.migrations] schema_paths` in `packages/database/supabase/config.toml`. Schema files are applied in that order, you may need to be strategic in placing your file.
4. `turbo check-schema`, which will do the following:
    1. Check your logic with `sqruff lint supabase/schemas`
        1. If there are errors there, you can fix them with `pnpm run lint:fix`
    2. Stop Supabase.
    3. See if there would be a migration to apply with `supabase db diff`
5. If applying the new schema fails, repeat step 4
6. If you are satisfied with the migration, create a migration file with `pnpm run dbdiff:save some_meaningful_migration_name`
    1. If all goes well, there should be a new file named `supabase/migration/2..._some_meaningful_migration_name.sql` which you should `git add`.
7. `turbo build`, which will do the following:
    1. Start Supabase
    2. Apply the new migration locally
    3. Regenerate the types file with `supabase gen types typescript --local > src/dbTypes.ts`
    4. Copy it where appropriate
8. You can start using your changes again `turbo dev`
9. When your migration is pushed in a branch, Supabase will create a branch instance. Note there is a small cost to this, so we do not want those branches to linger.
    The branch will be also created without data. (Seed data could be added to `.../supabase/seed.sql`)
    The Vercel branch instance will talk to this Supabase branch. This is a wholly separate environment, and will not affect production.

#### Concurrent development

If schema changes are deployed to `main` by another developer while you work on your branch:

1. Rebase your branch on `main` so you have the latest migration.
2. If your new migration file has already been applied to your local database (step 7 above), you may have to revert it.
    1. `supabase migration repair --status reverted <migration timestamp> --local`
        * Note: This does not actually revert the migration, it tells Supabase that the migration was not applied, even if it was.
    2. If your migration is not idempotent (which you'll notice in stage 4), you may have to revert some of your migration's changes in the local database, using the SQL editor in the studio, or `psql`.
    3. If all else fails, you can reset your local database with `supabase db reset --local`
3. If you have an ongoing migration file, the timestamp at the start of the name should come after the latest new migration. Rename (or `git mv`) as needed.
4. Apply `turbo build` again, so the incoming migrations are applied, and then your working migration. You may have to fix the schema and migration to take the changes into account.

### Testing the backend

There are [cucumber](https://cucumber.io/) scenarios (in `packages/database/features`) to test the flow of database operations. We have not yet automated those tests, but you should run against the local environment when developing the database. You will need to:

1. Run `turbo dev` in one terminal (in the root directory)
2. In another other terminal, `cd` to this directory (`packages/database`) and run the tests with `pnpm run test`

Think of adding new tests if appropriate!

## Using local code against your Supabase branch

You may want to test your local code against the Supabase branch database that was created after push (step 10 above) instead of using the branch database only through the Vercel branch deployment.

First, you will need to set `VERCEL_TOKEN` from 1password, and set it either as an environment variable or in `packages/database/.env`.

Then, use `vercel link` to link the local database to the Vercel project.

If you are working on frontend code that only speaks to the database through the Vercel API endpoints, the easiest is to use the Vercel branch website, which will talk to the Supabase branch. You would run `pnpm run genenv -- branch` in this directory; then set `NEXT_API_ROOT` to the value given in `packages/database/.env.branch`, which was generated by the previous step. It can be set in your console, or temporarily in `packages/database/.env`.

In most other cases, you need to tell your code to fetch data from the branch. Set `SUPABASE_USE_DB=branch` in your console before running `turbo dev`. It will use the current git branch, but you can also override this with `SUPABASE_GIT_BRANCH=<branch name>`.

## Using local code against the production branch

This should be used with extreme caution, as there is not currently adequate security to prevent changes to the data.
It may be appropriate if there is a problem in production that is due to corrupted data (vs schema issues), and it is somehow simpler to test code to repair it directly than to load the data locally.
Again, if all your code is running through Vercel API endpoints, the simplest way is to set `NEXT_API_ROOT` to the url of the API of the production Vercel branch (`https://discoursegraphs.com/api`).
But in most other cases, you will want your code to talk to the production database. set up vercel as above, and set `SUPABASE_USE_DB=production` in your console before running `turbo dev`.
