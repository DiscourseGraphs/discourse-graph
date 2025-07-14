This contains the database schema for vector embeddings and concepts.

There are three usage scenarios:

## Local development setup

Normal scenario: Your backend and frontend will work against a database instance within docker.
It does mean you will have a fresh database with minimal data.

1. Installation
   1. Install [Docker](https://www.docker.com)
   2. Set the `SUPABASE_WORKDIR` in your environment to the absolute path of the `packages/database` directory.
   3. Install [sqruff](https://github.com/quarylabs/sqruff)
   4. Populate your `.env.localdb` from the `.env.example`
   5. `supabase start` to create your local supabase instance
       1. Many values will be specified in the output. Use them to populate your `.env.localdb` as follows:
       ```
       SUPABASE_JWT_SECRET = <JWT secret>
       SUPABASE_ANON_KEY = <anon key>
       SUPABASE_SERVICE_ROLE_KEY = <service_role key>
       ```
    6. Copy (or link) your `env.localdb` to `.env`
    7. Optional: `supabase end` to free docker resources.
2. Usage:
   1. `turbo dev`, will do a `supabase start` so you can talk to your local database.
   2. You can use the studio to look over things; its url is given by `supabase start`.
   3. End you work session with `supabase end` to free docker resources.
3. Database-specific development: We follow the supabase [Declarative Database Schema](https://supabase.com/docs/guides/local-development/declarative-database-schemas) process.
   1. Assuming you're working on a feature branch.
   2. Make changes to the schema, by editing files in `packages/database/supabase/schemas`
   3. If you created a new schema file, make sure to add it to `[db.migrations] schema_paths` in `packages/database/supabase/config.toml`. Schema files are applied in that order, you may need to be strategic in placing your file.
   4. `turbo check-types`, which will do the following:
      1. Check your logic with `sqruff lint supabase/schemas`
         1. If there are errors there, you can fix them with `npm run lint:fix`
      2. Stop supabase.
      3. See if there would be a migration to apply with `supabase db diff`
   5. If applying the new schema fails, repeat step 4
   6. If you are satisfied with the migration, create a migration file with `npm run dbdiff:save some_meaningful_migration_name`
      1. If all goes well, there should be a new file named `supabase/migration/2..._some_meaningful_migration_name.sql` which you should `git add`.
   7. `turbo build`, which will do the following:
      1. Start supbase
      2. Apply the new migration locally
      3. Regenerate the types file with `supabase gen types typescript --local > types.gen.ts`
      4. Copy it where appropriate
   8. You can start using your changes again `turbo dev`
   9. If schema changes are deployed to `main` while you work:
      1. Rebase your branch on `main` so you have the latest migration.
      2. If that new migration file has already been applied to your local database (step 7), you may have to revert it.
         1. `supabase migration repair --status reverted <migration timestamp> --local`
         2. If your migration is not idempotent (which you'll notice in stage 4), you may have to undo some changes in the local database, using the SQL editor in the studio, or `psql`.
         3. If that fails, you can reset your local database with `supabase db reset --local`
      3. If you have an ongoing migration file, the timestamp at the start of the name should come after the latest new migration. Rename as needed.
      4. Apply `turbo build` again, so the incoming migrations are applied, and then your working migration. You may have to fix the schema and migration to take the changes into account.
    10. When your migration is pushed in a branch, supabase will create a branch instance. Note there is a small cost to this, so we do not want those branches to linger.
        The branch will be also created without data. (Seed data could be added to `.../supabase/seed.sql`)
        The vercel branch instance will talk to this supabase branch. This is a wholly separate environment, and will not affect production.

## Using local code against your supabase branch

You may want to test your local code against the supabase branch database that was created after push (step 10 above) instead of using the branch database only through the vercel branch deployment.

If you are working on frontend code, the easiest is to use the vercel branch website, which will talk to the supabase branch. You would set the environment variable `NEXT_API_ROOT` (forthcoming) to the url of the api of the active vercel branch instance (as given in the [vercel interface](https://vercel.com/discourse-graphs/discourse-graph/deployments).)

If you have logged in with the vercel cli tool, you can also get the URL with `vercel list -m githubCommitRef=<branch name>`

If you are working on the website api code itself, you need to create a different, branch-specific `.env` based on the `.env.productiondb.example`, with values populated from the supabase UI for the branch. (In that case, you'll be maintaining two or more separate `.env` files. It may be appropriate to call them by different names, such as `.env.local`, `.env.branch1`, etc. But turbo only recognizes `.env`, so you would have to overwrite `.env` with whichever of your `.env.variant` file is appropriate according to your current task.)

IMPORTANT: Avoid using any supabase command while this environment is active. It is also safer to stop your local supabase altogether.

1. Navigate to our [supabase ui page](https://supabase.com/dashboard/project/zytfjzqyijgagqxrzbmz/settings/general)
2. In the top breacrumbs, where it says `main (Production)`, select the branch you're working on
3. In bottom of the leftmost menu bar, choose the project settings (⚙️)
4. Populate your `.env` variables using this information, in particular:
   1. The `General` tab has the `Project ID`, which you can use for `SUPABASE_PROJECT_ID` and `SUPABASE_URL`
   2. The `API Keys` tab has the `anon` and `service_role` keys, for `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
   3. The `JWT Keys` tab has the `JWT secret` value, for `SUPABASE_JWT_SECRET`


## Using local code against the production branch

This should be used with extreme caution, as there is not currently adequate security to prevent changes to the data.
It may be appropriate if there is a problem in production that is due to corrupted data (vs schema issues), and it is somehow simpler to test code to repair it directly than to load the data locally.
In that case, basically use the `.env.productiondb.example` file, fill the secrets and copy it to `.env`


## Testing the backend

There are cucumber scenarios to test the flow of database operations. We have not yet automated those tests, but you should run them when developing the database. You will need to

1. Run `turbo dev` in one terminal (in the root directory)
  1. Take note of the `API URL`, `anon key` and `service role key` in the `@repo/database task`
2. In another other terminal, `cd` to this directory (`packages/database`)
  1. Set the environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to the values noted above, respectively.
  2. Run the tests with `npm run test`

Think of adding new tests if appropriate!
