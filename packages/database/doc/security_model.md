# Database access control

This note explains how the database decides who can read and write what, why some of its choices look risky to Supabase's security advisor, and the rules a change must follow to keep access correct. Read it before adding a table, a policy, a view or a `SECURITY DEFINER` function. Update it when one of those rules changes.

## Roles

Supabase sends every API request as one of three Postgres roles:

- `anon`: a request made with the public API key and no login.
- `authenticated`: a logged-in request. The plugins log in as their space's "anonymous" account (`agent_type = 'anonymous'`), so they use `authenticated`, not `anon`.
- `service_role`: the server key. It bypasses row-level security. Edge functions such as `create-space` use it; clients never get it.

`anon` reads almost nothing today.

## How access is enforced

Every table has row-level security (RLS) policies. Postgres checks them for each row a query touches.

The policies call helper functions such as `my_space_ids(access_level)` and `account_ids_in_shared_spaces(access_level)`. Most helpers are `SECURITY DEFINER` with `SET search_path = ''`: they run with the owner's rights, so they can read `SpaceAccess` and `group_membership` without being filtered by those tables' policies, and a policy calling them doesn't recurse into other policies.

The `SET` clause stops Postgres from inlining a helper, so a helper that takes a row column runs its own query for every row. Policies avoid this by calling helpers that take no row column, wrapped in `(SELECT ...)`, for example `space_id = any((SELECT my_space_ids('reader'))::bigint [])`. Postgres evaluates that form, an InitPlan, once per query (ENG-2443, ENG-2446). The policies on the contributor tables' writes, `group_membership` and `sync_info` still call a helper per row.

`my_user_accounts()` is the base of most helpers. It returns the current user's id and the ids of the groups they belong to. A space or resource is accessible when a `SpaceAccess` or `ResourceAccess` row grants it to one of those ids. It is declared `ROWS 10`, because Postgres can't inline it and its default estimate of 1000 rows makes the planner scan `SpaceAccess`. The hint changes only the plan, not who sees what.

### Policies that read `LocalAccess`

The `AgentIdentifier` select policy and the `PlatformAccount` write policies read `LocalAccess` directly, through its primary key, so checking one account stays cheap. They read it as the caller, so its own select policy filters what they see: narrowing `local_access_select_policy` narrows them too, with no error.

That filter starts at `reader`, but `PlatformAccount` rows are visible from `partial`. So the `PlatformAccount` select policy reads the definer view `accounts_in_my_partial_spaces` instead. Unlike a function, Postgres can inline a view, so one account is checked per row through the primary key, and a full read builds its set once. Three things about this view must stay:

- `DISTINCT`, and no `space_id` column. One row per membership would reveal memberships that `LocalAccess` hides below `reader`.
- `security_barrier`. Without it, a caller's filter that isn't `LEAKPROOF` can run below the access join and see accounts from other spaces.
- Its grants: `SELECT` only. `anon` holds it for public access (see [Grants made for public access](#grants-made-for-public-access)). It returns no rows to `anon` today.

### Account and group writes

- `authenticated` can't insert into `PlatformAccount`, and has `UPDATE` on it per column, so clients can't set who owns an account (`dg_account`) or change what identifies it (`agent_type`, `platform`, `account_local_id`). A new column isn't client-writable until it's added to the grant. Clients create and upsert accounts through `upsert_account_in_space`, which also adds the account to the space (ENG-2447).
- `upsert_account_in_space` requires editor access to the space, and grants no `SpaceAccess` (ENG-2439). `LocalAccess` says an account belongs to a space and grants nothing.
- `LocalAccess` writes require editor access to the row's own space (ENG-2447).
- Only a group's admins can add members. The `create-group` edge function adds the first admin with the service role, and `accept_group_invitation` adds invited members (ENG-2438).

### Account reads

- `authenticated` has `SELECT` on `PlatformAccount` per column, without `dg_account` and `metadata`, and `my_accounts` leaves out both columns too (ENG-2441). `dg_account` would show which accounts belong to one person, and nothing uses `metadata` yet.
- A column grant applies to every row, so clients can't read their own `dg_account` from the table either. They get their own user id from their session, and their own accounts from `my_platform_account_ids`.
- Clients must name the columns they read from `PlatformAccount`. `select("*")`, and any filter on a hidden column, fails with a permission error.
- `my_pseudo_accounts` returns `dg_account`, so it has to stay a definer view. Any `anon` grant on `PlatformAccount` has to use the same column list.

### The `my_*` views

The `my_*` views (`my_spaces`, `my_accounts`, `my_concepts`, `my_contents`, `my_documents`, `my_file_references`, `my_contents_with_embedding_openai_text_embedding_3_small_1536`, `my_pseudo_accounts`, `my_groups`) are the main way clients read data.

They are not `security_invoker`: they run as their owner, bypass RLS, and apply their own access filter. This was done for speed, when policies called their helpers once per row and large reads timed out (ENG-1433, ENG-1435). The views compute the user's accessible spaces once per query, in the InitPlan form above (ENG-2344, ENG-2359).

The policies now use that form too, but most views stay definer, because they're still faster. Under RLS, a filter that isn't `LEAKPROOF` has to run after the policy, so it can't use an index. `concept_in_relations` filters with `@>`, and took about 250 times as long through RLS with 273 `ResourceAccess` rows. Reading the tables directly has the same cost. So by default, clients read through these views and write to the tables. The timings are on ENG-2444, which is parked.

Consequences:

- Each view's filter is a second copy of the table's access rules. A change to a policy must be repeated in the views that read the table. We accept this cost, and the security advisor keeps reporting these views.
- Single-table views are automatically updatable, and writes through them would also bypass RLS. Write privileges are revoked on `my_spaces`, `my_accounts`, `my_concepts`, `my_contents`, `my_documents` and `my_file_references` (ENG-2368, ENG-2359). Any new updatable view needs the same `REVOKE`.
- Clients depend on the view names and columns, including older plugin versions that are still installed, PostgREST's foreign-key inference and the generated types. Keep them stable.
- They have no `security_barrier`, so a caller's filter that isn't `LEAKPROOF` can run below the access filter and see rows the view would hide (measured on `my_accounts`). PostgREST's fixed filter operators shouldn't allow such a filter, so this matters for direct SQL access. The same reordering is what lets `@>` use its index, so time the relation queries before adding `security_barrier` to `my_concepts`.

## Function grants

A new function in `public` is executable by `authenticated` and `service_role`, not by `anon`. `base.sql` sets this with default privileges, in two parts:

- It revokes `anon` from the `public` schema's defaults, which Supabase sets up to include it.
- It revokes `PUBLIC` from the global defaults of the `postgres` role. Postgres grants EXECUTE on every new function to `PUBLIC`, and `anon` inherits it, so the first part alone changes nothing. A schema-level default cannot remove a global one, so this also applies to functions that `postgres` creates in other schemas.

Every `anon` grant and every revoke is explicit, next to the function in its schema file, with a `--` comment saying which client or policy needs it. Functions that are not `SECURITY DEFINER` run as the caller under RLS, so they are granted to `anon` as a group, at the end of their schema file.

`CREATE OR REPLACE FUNCTION` keeps a function's grants, but `DROP FUNCTION` followed by `CREATE FUNCTION` loses them. A migration that recreates a function must repeat its `anon` grant. Dropping a view also drops the functions that return its row type, such as `author_of_concept` and `author_of_content` for `my_accounts`, so they need their grants repeated too.

### Rules

1. A function or view used by a policy must be usable by every role that queries that table: EXECUTE on the function, SELECT on the view. Without it, the query fails with a permission error; it does not return zero rows.
2. Functions called in a view are checked against the role querying the view, not the view owner. A function that is not `SECURITY DEFINER` also runs its body as that role, under the policies of whatever it reads. For example, the views call `my_accessible_resources()`, which reads `ResourceAccess` as the caller.
3. Trigger functions need no grant. Postgres checks EXECUTE when the trigger is created, not when it fires.
4. A `SECURITY DEFINER` function that clients can call must check the caller's access itself, because it skips RLS. Don't rely on capping a permission with `least(...)`: `LEAST` ignores NULL, so a caller with no access (NULL) gets the other argument.
5. A helper that clients can call may reveal only facts about the caller, facts about resources the caller can read, or facts about identities whose owner made them public.

One helper doesn't follow rule 5 yet. `file_exists` says whether any space holds a file with a given hash; the caller must already know the hash.

### Functions `anon` can execute

| Function           | Why                                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_secret_token` | The website's `/auth/token` route, which hands a plugin's session to a browser that isn't logged in yet. The token is 12 random bytes, single use, with a 45-second expiry for this flow |
| `my_user_accounts` | Public access: base of the views and helpers                                                                                                                                             |
| `my_space_ids`     | `Space` select policy; `anon` can read `Space`. Public access: the `my_*` views and the other select policies                                                                            |
| `file_access`      | Public access: the storage read policy on the `assets` bucket                                                                                                                            |

All other `SECURITY DEFINER` functions are executable by `authenticated` only. Trigger functions, and `is_last_local_reference` (which only triggers call), are executable by neither role.

`in_space` is not executable by `anon`. Only write paths reach it as the caller, and `anon`'s reads use `my_space_ids`.

`anon` holds only `SELECT` on the contributor tables, and its reads fail with a permission error on `ResourceAccess` until public access adds the grants below.

### Grants made for public access

`anon` will read public nodes, their files and their authors (ENG-1837). The "Public access" entries above, and `anon`'s `SELECT` on `accounts_in_my_partial_spaces`, `my_resource_grants` and the contributor tables, are grants made ahead of that work. Keep them: rule 1 means that removing one fails those queries with a permission error. ENG-1837 also has to grant `anon` `SELECT` on `Concept`, `Content`, `Document`, `FileReference` and `ResourceAccess`, and open `storage_select_assets_access` to `anon`, which today applies only to `authenticated`.

## Supabase advisor findings that remain

Supabase runs two advisors on the database, one for security and one for performance. Both check shapes, not behaviour, so some of their findings are expected and stay.

### Security advisor

It flags any view that bypasses RLS, any view that reads `auth.users`, any policy whose condition is always true, and any `SECURITY DEFINER` function a client role can execute. It can't tell whether a function or view leaks anything. These findings are expected:

- `my_groups` reads `auth.users` (`auth_users_exposed` and `security_definer_view`). Groups are rows in `auth.users`, with the synthetic email `{group name}@groups.discoursegraphs.com` set by the `create-group` edge function. The view returns only the id and name of the groups the current user belongs to; `anon` gets no rows. It must run as its owner, because clients can't read `auth.users`. This stays.
- The other eight `my_*` views (`security_definer_view`). This is the speed workaround described above.
- `accounts_in_my_partial_spaces` (`security_definer_view`). It runs as its owner on purpose, to read `LocalAccess` below `reader` (see above). It stays.
- `anon_security_definer_function_executable` for the four functions in the table above.
- `authenticated_security_definer_function_executable` for the policy helpers and for the functions that clients call directly: `create_account_in_space`, `upsert_accounts_in_space`, `file_exists`, `create_secret_token`, `get_secret_token`, `accept_group_invitation`. Also for `upsert_account_in_space`: no client calls it, but `upsert_content` and `upsert_documents` run as the caller, so the caller needs `EXECUTE`.
- `space_insert_policy` on `Space` (`rls_policy_always_true`). The insert policy is `WITH CHECK (true)`, but no client relies on it: `create-space` creates spaces with the service role. Whether to remove it is still open. Reading, changing and deleting a space still require access to it: those policies check `my_space_ids`.

### Performance advisor

These findings are expected:

- `FileReference_content_fkey` (`unindexed_foreign_keys`). Deleting a `Content` row looks up its `FileReference` rows through the primary key `(source_local_id, space_id, filepath)`. The advisor flags it only because the key's column order differs from the foreign key's.
- The foreign keys from `AgentIdentifier.account_id`, `LocalAccess.space_id`, `SpaceAccess.space_id`, `concept_contributors.contributor_id` and `content_contributors.contributor_id` (`unindexed_foreign_keys`). Only deleting an account or a space would use an index on them, and both are rare. Revisit if either becomes routine.
- The foreign keys from `Concept.author_id`, `Content.author_id`, `Content.creator_id` and `Document.author_id` (`unindexed_foreign_keys`). An index would help account deletion and queries by author, neither of which is in use yet, and every sync insert would pay for it. Decide when the first feature that needs one is planned, measured against its queries. A composite index such as `(space_id, author_id)` may fit better, since reads are already scoped to a list of spaces.
- `Content_text` (`unused_index`). Kept for database searches on content text, which are planned but not yet used.

Any other finding from either advisor is new, and should be fixed or added here with its reason.

## Checklist for changes

- New table: enable RLS, write policies for each operation, and revoke `anon` unless anonymous readers need it. Add visibility scenarios to `features/`, like `features/conceptAccess.feature`.
- New policy: wrap calls that don't depend on the row in `(SELECT ...)`. Write `(SELECT auth.uid())`, not `auth.uid()`. Don't pass a row column to a helper that sets `search_path`. If the policy reads another table directly, remember that table's own select policy filters what it sees.
- New `PlatformAccount` column: decide whether clients may read or write it, and add it to the per-column grants if so.
- New `SECURITY DEFINER` function: set `search_path = ''`, check the caller's access inside it (rule 4), grant it only to the roles that call it, and add a comment saying who that is.
- New function that `anon` reaches, directly, through a policy or through a view: grant it to `anon` in its schema file and in the migration.
- New trigger function: revoke it from `anon` and `authenticated`.
- New or changed view: keep existing names and columns, mirror the table's access rules, and revoke write privileges if the view is updatable.
- New definer view: `REVOKE ALL` and then `GRANT SELECT`, because default privileges give write privileges. Set `security_barrier`, and return only what every caller may already see, including through row counts.
- Before merging, run the cucumber suite and compare both Supabase advisors' lists with the findings above.

## History

- ENG-950, ENG-1433, ENG-1435: the `my_*` views, introduced to avoid per-row policy costs.
- ENG-2344, ENG-2359: the views rewritten with InitPlans.
- ENG-2368: write privileges revoked on the updatable views.
- ENG-1480, ENG-2436: Supabase findings reviewed and documented.
- ENG-2438: joining a group limited to its admins, and `group_exists` removed.
- ENG-2439: `upsert_account_in_space` requires editor access and grants no `SpaceAccess`.
- ENG-2441: `dg_account` and `metadata` removed from `my_accounts` and hidden on `PlatformAccount`.
- ENG-2442: function grants made explicit, and new functions no longer executable by `anon`.
- ENG-2443, ENG-2446: policies moved to the InitPlan form, and `can_access_account`, `can_view_concept`, `can_view_content`, `account_in_shared_space`, `unowned_account_in_shared_space` and `is_my_account` removed.
- ENG-2447: account columns granted individually, and `LocalAccess` writes checked against the row's space.
- ENG-2448: the unused `access_token` table removed.
