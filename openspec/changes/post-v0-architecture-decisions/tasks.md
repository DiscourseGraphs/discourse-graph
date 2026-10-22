# Tasks

Each task is an existing Linear ticket. It names the requirements (from `specs/`) and the decisions (from `design.md`) it carries, and how its completion is verified, taken from the ticket's Done When. Groups follow the order of work in `design.md`.

## 1. One write per node in sync

- [ ] 1.1 [ENG-1823] Use the unified upsert_concepts in Obsidian. Carries: `graph-writes` "One write per node"; decision "Do ENG-1823 and ENG-1824 wait for the route?" (no). Verify: no `upsert_content` call is left in `apps/obsidian`.
- [ ] 1.2 [ENG-2061] Refactor `RoamFullContentNode` to use `CrossAppNode` contract. Carries: decision "What does ENG-2061 cover?" (only removes the type). Verify: `RoamFullContentNode` is gone from the Roam codebase, including tests.
- [ ] 1.3 [ENG-1824] Use the unified upsert_concepts in Roam, as a step of [ENG-2165] after 1.2. Carries: `graph-writes` "One write per node"; decisions "Do ENG-1823 and ENG-1824 wait for the route?" and "Is ENG-2165 a step of ENG-1824?". Verify: no `upsert_content` call is left in `apps/roam`, including test harnesses.
- [ ] 1.4 [ENG-1794] Atomic upsert of Concept and Content. Carries: decision "Does ENG-1794 need a decision of its own?" (no). Verify: 1.1 and 1.3 are done.
- [ ] 1.5 [ENG-2165] Refactor Roam Sync to use crossAppNodes: the remaining steps of the PR #1333 split, written when someone picks it up, with Michael reviewing. Carries: `graph-writes` "Roam sync and Roam publish store the same values"; decision "How does PR #1333 split?". Verify: both publish-then-sync scenarios hold, and the old sync path is removed.
- [ ] 1.6 [ENG-2166] Make upsertConcepts more like a PATCH than PUT: close it once 1.5 is done. Carries: decision "Is PATCH behaviour in upsert_concepts still needed?" (no). Verify: the ticket is closed with a comment that points to [ENG-2165].

## 2. Bugs found while scoping PR #1333

- [ ] 2.1 [ENG-2425] Roam sync misses node type changes made in the type's child blocks. Carries: decision "Do the items PR #1333 deferred get tickets?". Verify: after an edit to a node type's format or template, the next sync writes the updated node schema, and a test covers it.
- [ ] 2.2 [ENG-2426] Roam sync leaves a published node's direct Content stale when its type uses a first-child description. Best after 1.3. Carries: the same decision. Verify: after an edit, the next sync updates the `direct` Content, and discovery in another space shows the new title.

## 3. Discovery returns CrossAppNode

- [ ] 3.1 [ENG-1985] Define converters between database schemas and cross-app schemas: add the database-to-`CrossAppNode` converter for nodes. Carries: decision "Which ticket builds the database-to-CrossAppNode converter?". Verify: the converters cover all schemas, nodes included.
- [ ] 3.2 [ENG-2091] Unify SharedNode and CrossAppNode, after 3.1. Carries: `shared-node-discovery` (all requirements); decisions "What does discovery return?" and "Which fields does CrossAppNode gain?". Verify: `SharedNode` is gone without loss of functionality, and the discover dialog filter scenario holds.
- [ ] 3.3 [ENG-2045] Remove Obsidian getPublishedNodesForGroups wrapper, after 3.2. Carries: decision "Does ENG-2045 wait for ENG-2091?". Verify: `getPublishedNodesForGroups` and `PublishedNode` are gone, and Obsidian import uses the type from 3.2.

## 4. Relations

- [ ] 4.1 [ENG-2394] Choose how Obsidian retrieves relations made elsewhere between its own nodes. Carries: decision "How does Obsidian find relations made elsewhere between its own nodes?". Verify: the decision comment records the trigger, the notice, the duplicate handling and the reproduction.
- [ ] 4.2 [ENG-2427] Obsidian imports relations made elsewhere between its own nodes on import and refresh. Carries: `cross-space-relation-import` (all requirements). Verify: the user A and user B scenario imports the relation once and shows the notice.
- [ ] 4.3 [ENG-1866] Validate Obsidian relation export against the shared contract: close it. Carries: decision "Do we still need ENG-1866?" (no). Verify: the ticket is closed and no longer blocks [ENG-1874].

## 5. Upsert route, when someone picks up FEE-890

- [ ] 5.1 [FEE-890] Create a generic upsert route that accepts all root CrossApp types. First decide its open details (Michael). Carries: `graph-upsert-route` "The route takes CrossApp types…" and "The route identifies the caller from the plugin's own login"; the route decisions in `design.md`. Verify: nodes, relations and schemas can be written with a single call to the route.
- [ ] 5.2 [ENG-2005] Zod validators for the cross-app types. Carries: `graph-upsert-route` "The route checks the request body before writing". Verify: an arbitrary JSON object can be checked against the CrossApp types.
- [ ] 5.3 [FEE-891] Test the generic upsert route. Carries: decision "How do the route's tests run?". Verify: the route is tested, with a rejection case if 5.1 rejects incomplete payloads.
- [ ] 5.4 [ENG-1986] Refactor Obsidian sync to use the new cross-app schemas, before Obsidian moves onto the route. Carries: decisions "Is ENG-1986 a step of ENG-1823?" and "Which Obsidian fields must the CrossApp types cover?" (open, Marc-Antoine). Verify: Obsidian sync runs through the CrossApp converters without loss of functionality.

## Not covered by a ticket

- Moving Roam sync, Obsidian sync and Roam publish onto the upsert route. Tickets get created after [FEE-890] is built.
- The plugin-login requirement. It belongs in [FEE-890]; its description doesn't say so yet, so a decision comment adds it.
- Confirming that the 2026-10-08 report matches the code reading for [ENG-2394] (Michael).
- The relation fixtures [ENG-1863] promised. Only if a regression test is wanted.
- The two Roam relation converters in `conceptConversion.ts` that nothing calls. No ticket, by Sid's call.

## Workflow follow-up

- Michael and Marc-Antoine review the decisions on the tickets and in the two decision films.
- Sid then updates Linear: removes "blocked by FEE-890" from [ENG-1823] and [ENG-1824] and "ENG-1985 blocks ENG-1986", re-parents [ENG-1824] and [ENG-2061] under [ENG-2165], moves approved tickets to Architecture Refactors, closes [ENG-1866], and reviews [ENG-2425], [ENG-2426] and [ENG-2427] out of Ticket Draft.

[ENG-1794]: https://linear.app/discourse-graphs/issue/ENG-1794
[ENG-1823]: https://linear.app/discourse-graphs/issue/ENG-1823
[ENG-1824]: https://linear.app/discourse-graphs/issue/ENG-1824
[ENG-1863]: https://linear.app/discourse-graphs/issue/ENG-1863
[ENG-1866]: https://linear.app/discourse-graphs/issue/ENG-1866
[ENG-1874]: https://linear.app/discourse-graphs/issue/ENG-1874
[ENG-1985]: https://linear.app/discourse-graphs/issue/ENG-1985
[ENG-1986]: https://linear.app/discourse-graphs/issue/ENG-1986
[ENG-2005]: https://linear.app/discourse-graphs/issue/ENG-2005
[ENG-2045]: https://linear.app/discourse-graphs/issue/ENG-2045
[ENG-2061]: https://linear.app/discourse-graphs/issue/ENG-2061
[ENG-2091]: https://linear.app/discourse-graphs/issue/ENG-2091
[ENG-2165]: https://linear.app/discourse-graphs/issue/ENG-2165
[ENG-2166]: https://linear.app/discourse-graphs/issue/ENG-2166
[ENG-2394]: https://linear.app/discourse-graphs/issue/ENG-2394
[ENG-2425]: https://linear.app/discourse-graphs/issue/ENG-2425
[ENG-2426]: https://linear.app/discourse-graphs/issue/ENG-2426
[ENG-2427]: https://linear.app/discourse-graphs/issue/ENG-2427
[FEE-890]: https://linear.app/discourse-graphs/issue/FEE-890
[FEE-891]: https://linear.app/discourse-graphs/issue/FEE-891
