# Proposal

## Why

The "Architecture Decisions" milestone of [Post-V0 Roam–Obsidian sync architecture][project] holds tickets whose approach was deferred during v0. Deciding them one ticket at a time gave conflicting answers: [ENG-1824] marked the upsert route out of scope, while the 2026-07-17 meeting agreed it would use the route ([ENG-2412]). This change records the milestone's decisions together, working backwards from the tickets that already exist ([ENG-2416]).

## What Changes

- Roam sync and Obsidian sync write each node in one `upsert_concepts` call, with its Content inside the Concept. They switch now and don't wait for the upsert route ([ENG-1823], [ENG-1824], [ENG-1794]).
- Roam sync moves onto the CrossApp converters that Roam publish uses, in small steps under [ENG-2165]: [ENG-2061] first, then [ENG-1824].
- One upsert route in Next.js stays the goal, with no date ([FEE-890]). It accepts the plugin's own Supabase login.
- Discovery returns `CrossAppNode` with the fields it was missing ([ENG-2091]). **BREAKING** for `@repo/database` callers: the `SharedNode` type is removed.
- Obsidian imports relations made elsewhere between its own nodes, the same way Roam does ([ENG-2394]).
- [ENG-1866] closes: the validation it asked for happened in other tickets. [ENG-2166] closes once [ENG-2165] lands.

## Decisions: settled and open

Settled by Sid (2026-10-19 to 2026-10-22):

- One upsert route stays the goal. When it gets built isn't decided ([FEE-890]).
- [ENG-1823] and [ENG-1824] don't wait for the upsert route. This departs from the 2026-07-17 agreement.
- No data migration is needed for the single write ([ENG-1823], [ENG-1824]).
- The upsert route's details stay open until someone picks up [FEE-890].
- [ENG-1824] is a step of [ENG-2165], which becomes the parent and is split into small PRs.
- Obsidian looks for relations the way Roam does, on import and refresh ([ENG-2394]).
- Confirmed proposals: the upsert route accepts the plugin's login; [ENG-1794] moves with its children; [ENG-2061] only removes `RoamFullContentNode`; [ENG-2166] closes after [ENG-2165]; [ENG-1986] comes later than [ENG-1823]; the `CrossAppNode` field list (a review of this change found three more fields, in `design.md`); [ENG-1985] builds the node converter; two bug tickets; [ENG-1866] closes; the [ENG-2394] details; the reject-or-look-up question waits for [ENG-1986].

Settled by the tickets or the code:

- Discovery returns `CrossAppNode` and `SharedNode` is removed ([ENG-2091] Solution and Done When). [ENG-2045] follows it.
- [ENG-1986] is no longer blocked by [ENG-1985]: the CrossApp-to-database converters it needs are on main.
- [ENG-2005] and [FEE-891] are built with [FEE-890].
- "sourceId" means `sourceLocalId`, which already maps to `localId` ([ENG-2091]).

Still open:

- Michael: the upsert route's details in [FEE-890] and [FEE-891] (reject or look up a missing relation type, the name, what a user does with an error, who computes embeddings, how the tests run). Michael also reviews the [ENG-2165] split.
- Marc-Antoine: for the three listing fields the first field list missed, add them to `CrossAppNode` or change their callers ([ENG-2091]); the field questions in [ENG-1986].
- Michael: whether refresh-all checks for relations when the user has no imported nodes, in both apps ([ENG-2428], Product Decisions).

`design.md` has one entry per decision. The specs state Sid's answers as requirements; review of this change is where Michael and Marc-Antoine weigh in.

## Capabilities

### New Capabilities

- `graph-writes`: how Roam and Obsidian write nodes to the shared database, one write per node, and which converters they use.
- `graph-upsert-route`: the planned Next.js route that takes CrossApp types and writes them to the database.
- `shared-node-discovery`: what discovery returns when a user lists the nodes in a shared space.
- `cross-space-relation-import`: how Roam and Obsidian find and import relations that another space made.

### Modified Capabilities

None. The project has no specs yet.

## Impact

- Roam: `syncDgNodesToSupabase.ts`, `upsertNodesAsContentWithEmbeddings.ts`, `conceptConversion.ts`, `convertRoamNodeToFullContent.ts`, `roamToCrossAppConverters.ts`, `DiscourseNodeSuggestiveRules.tsx` (a Content-only write), `refreshAllImportedNodes.ts`, and the 8 files that use `SharedNode`.
- Obsidian: `syncDgNodesToSupabase.ts`, `upsertNodesAsContentWithEmbeddings.ts`, `importNodes.ts`, `importRelations.ts`, `ImportNodesModal.tsx`, `types.ts`.
- `packages/database`: `crossAppContracts.ts`, `lib/sharedNodes.ts`, `lib/dbToCrossAppConverters.ts`.
- Website: a new route under `apps/website/app/api/` when [FEE-890] is built.
- Database: no schema change and no migration.

[project]: https://linear.app/discourse-graphs/project/post-v0-roam-obsidian-sync-architecture-1e0070a3bac6
[ENG-1794]: https://linear.app/discourse-graphs/issue/ENG-1794
[ENG-1823]: https://linear.app/discourse-graphs/issue/ENG-1823
[ENG-1824]: https://linear.app/discourse-graphs/issue/ENG-1824
[ENG-1866]: https://linear.app/discourse-graphs/issue/ENG-1866
[ENG-1985]: https://linear.app/discourse-graphs/issue/ENG-1985
[ENG-1986]: https://linear.app/discourse-graphs/issue/ENG-1986
[ENG-2005]: https://linear.app/discourse-graphs/issue/ENG-2005
[ENG-2045]: https://linear.app/discourse-graphs/issue/ENG-2045
[ENG-2061]: https://linear.app/discourse-graphs/issue/ENG-2061
[ENG-2091]: https://linear.app/discourse-graphs/issue/ENG-2091
[ENG-2165]: https://linear.app/discourse-graphs/issue/ENG-2165
[ENG-2166]: https://linear.app/discourse-graphs/issue/ENG-2166
[ENG-2394]: https://linear.app/discourse-graphs/issue/ENG-2394
[ENG-2412]: https://linear.app/discourse-graphs/issue/ENG-2412
[ENG-2428]: https://linear.app/discourse-graphs/issue/ENG-2428
[ENG-2416]: https://linear.app/discourse-graphs/issue/ENG-2416
[FEE-890]: https://linear.app/discourse-graphs/issue/FEE-890
[FEE-891]: https://linear.app/discourse-graphs/issue/FEE-891
