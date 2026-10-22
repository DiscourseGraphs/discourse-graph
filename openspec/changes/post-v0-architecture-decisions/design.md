# Design

## Context

See `proposal.md` for why. The state of main (`0b5aec5f`) that shapes the decisions:

- Roam sync and Obsidian sync write each node in two calls: Content with `upsert_content`, then the Concept with `upsert_concepts`. If the second call fails, the node is half-written. ENG-1794 counted 2,753 missing Concepts on 2026-05-24; nobody has measured since.
- Since [ENG-1793] and [ENG-1791] (2026-05-31), the first sync after a graph or vault loads writes such nodes again.
- `upsert_concepts` accepts each node's Content inside its Concept since [ENG-1822].
- Roam publish already writes once: it builds a `CrossAppNode`, converts it with the shared converter and makes one `upsert_concepts` call. Roam sync converts with its own functions, so the two Roam write paths can store different values for the same node. [ENG-2202] had to reconcile node schema metadata between them.
- Obsidian has one write path (its publish writes only `ResourceAccess`) and doesn't use the CrossApp types.
- Roam relations already go through the CrossApp types: Roam publish writes them, and Roam discovery and import read them. Node discovery is the one read path that still returns its own type, `SharedNode`.
- Both plugins sign in to Supabase themselves. The only plugin call to the website that touches Supabase today creates a space before sign-in.
- Michael set a rule on 2026-07-17: callers reach the upsert route through an action-specific function, such as publish or sync, that builds the payload.

## Goals / Non-Goals

**Goals:**

- Record one answer, or one owner, for every open decision in the milestone's tickets.
- Order the work so each ticket lands as a small PR that can be reviewed and tested on its own.

**Non-Goals:**

- Designing the upsert route's open details. They stay open for Michael.
- Background polling for relations. The project excludes it from MVP0.
- Moving Linear tickets between milestones. That waits until Michael and Marc-Antoine have seen the decisions.

## Decisions

Each entry gives the question, the answer, the options on record with who proposed them and when, and the reason. "Sid" answers were given in the decision review of 2026-10-19 to 2026-10-22. "Confirmed" means a proposal from that review that Sid confirmed on 2026-10-22.

### Upsert path ([ENG-2412])

#### Is one upsert route still the goal after v0? ([FEE-890])

- **Answer:** Yes. When it gets built isn't decided. (Sid, 2026-10-19)
- **Options on record:** One route that takes CrossApp types (Michael, 2026-07-16; Marc-Antoine proposed `/api/internal/upsert` the same day; agreed at the 2026-07-17 meeting). Reconsider after v0 (Sid and Michael, 2026-10-09).
- **Reason:** [ENG-1909]'s reason still holds: plugins that write straight to Supabase make translation and versioning harder. Users keep old plugin versions after a database change ships; with conversion on the server, the change ships with the website. Sync already calls the website for embeddings, so the route adds no new dependency for sync.
- **Follows:** [ENG-2005] (check the request body) and [FEE-891] (test the route) are built with [FEE-890].

#### Do ENG-1823 and ENG-1824 wait for the route? ([ENG-1823], [ENG-1824])

- **Answer:** No. Roam sync and Obsidian sync switch to one `upsert_concepts` call now. Moving sync and publish onto the route happens after [FEE-890] is built, in tickets created then if needed. (Sid, 2026-10-22)
- **Options on record:** Use the route (agreed at the 2026-07-17 meeting). Call `upsert_concepts` directly (the tickets' first option).
- **Departs from:** the 2026-07-17 agreement that [ENG-1823] and [ENG-1824] use the route.
- **Reason:** The route has no date, and [FEE-890] still has to be discussed, built and tested. Waiting keeps the half-written-node bug open for an unknown time. Roam publish already writes this way, so moving to the route later replaces one call per write path.

#### Does the single write need a data migration?

- **Answer:** No. (Sid, 2026-10-22)
- **Reason:** The database doesn't change. Half-written nodes are written again by the first sync after a graph or vault loads ([ENG-1793], [ENG-1791]). A space nobody opens keeps its half-written nodes; that's accepted.

#### Does ENG-1824 also move Roam publish onto the route? ([ENG-1824])

- **Answer:** No. Moving publish belongs to the follow-up tickets after [FEE-890]. (Sid, 2026-10-22)
- **Note:** Roam publish calls no website route today, so moving it onto the route adds a dependency that sync doesn't gain.

#### Does the route accept the plugin's own login? ([FEE-890])

- **Answer:** Yes. It's a requirement of [FEE-890], not a new ticket. (Confirmed)
- **Options on record:** None. PR #1237 (Marc-Antoine, 2026-07-18) reads the session from website cookies, which a plugin request doesn't carry; from reading the code, every plugin call would be refused with 401. This came up in the 2026-10-22 review.

#### A request is missing a relation type: reject it, or look it up? ([FEE-890], [FEE-891])

- **Answer:** Open, needs Michael. It can wait until [ENG-1986]. (Confirmed)
- **Options on record:** Look it up in the database (PR #1237, Marc-Antoine, 2026-07-18). Reject the incomplete payload, because action functions build complete payloads (Michael, PR #1237 review, 2026-07-19).
- **Reason it can wait:** On main, only a relation triple schema that names its relation type by id needs it, and nothing sends that form: the one caller, Roam publish, passes no relation type, and Obsidian doesn't use the CrossApp types. It arrives with [ENG-1986]. If the route rejects, [FEE-891] adds a rejection case.
- **Linked:** what `upsert_concepts` does with a node schema it can't resolve, carried over from [ENG-2166]. From reading `concept.sql`, the node is stored with no schema and no error; not run.

#### What is the route called? ([FEE-890])

- **Answer:** Open, needs Michael.
- **Options on record:** `/api/internal/space/[id]` (PR #1237, Marc-Antoine, 2026-07-18). `/api/internal/space/[id]/graph/upsert`, or `/graph` if a GET comes later (Michael, 2026-07-19). `/api/internal/upsert` (Marc-Antoine, 2026-07-16). `/api/data/[space_id]` with POST and PATCH (Marc-Antoine, 2026-07-07).

#### When the route fails, what can a user do with the error? ([FEE-890])

- **Answer:** Open, needs Michael.
- **Options on record:** None. Michael asked on 2026-07-19 ("as a user, when I receive this message, what should I do with it?").
- **Context:** `upsert_concepts` returns one id per row: -1 for a name conflict, -2 for any other error. Roam sync throws with a count per code, Roam publish matches failures to its rows, Obsidian sync ignores the ids, and PR #1237 returns the database result as-is.

#### Who computes embeddings? ([FEE-890])

- **Answer:** Open, needs Michael.
- **Options on record:** None. [FEE-890] asks whether "all aspects of upserting" include embeddings.
- **Context:** Today each plugin gets vectors from the website and sends them inline; the CrossApp contract allows that. Estimate, not measured: a vector is about 20 KB as JSON, so a Roam batch of 200 nodes carries about 4 MB of vectors, close to the 4.5 MB request limit of a Vercel function, before [ENG-1824] adds full content. Either way, batch size becomes part of the route's design.

#### How do the route's tests run? ([FEE-891])

- **Answer:** Open, needs Michael.
- **Options on record:** PR #1238 (Marc-Antoine, 2026-07-19) starts Next for the whole database suite and waits for its "Ready in" output. Michael (review, 2026-07-20) asked to run only the route's feature in its own job and to wait with an HTTP health check.

#### Is PATCH behaviour in upsert_concepts still needed? ([ENG-2166])

- **Answer:** No, once [ENG-2165] lands. [ENG-2166] stays in Icebox and closes then. Its field list and its `reference_content` question go with it; its schema question moves to the reject-or-look-up entry above. (Confirmed)
- **Options on record:** Make `upsert_concepts` keep absent fields (Marc-Antoine, PR #1334, 2026-08-23). Remove the cause by giving Roam sync and publish one conversion ([ENG-2166]'s own first question).
- **Reason:** The overwrites come from two Roam write paths that disagree. One conversion removes the cause.

#### Does ENG-1794 need a decision of its own? ([ENG-1794])

- **Answer:** No. Its database half shipped in [ENG-1822]. It moves with [ENG-1823] and [ENG-1824]. (Confirmed)

### CrossApp types ([ENG-2413])

#### Is ENG-2165 a step of ENG-1824, or does it replace it? ([ENG-2165], [ENG-1824])

- **Answer:** [ENG-1824] is a step of [ENG-2165], which becomes the parent. PR #1333 is split into small PRs. (Sid, 2026-10-22)
- **Options on record:** Step or replace ([ENG-2165]'s ticket text). Only merge the calls with today's converters, and leave [ENG-2165] for later (raised in the 2026-10-22 review). Michael asked on 2026-08-28 for PR #1333 to be split into smaller tickets.
- **Reason:** Small PRs are easier to review and test, and each keeps the reviewer's and the implementer's context focused. [ENG-1824]'s own Solution already converts through `CrossAppNode`. The two Roam converters have already drifted once ([ENG-2202]), and only merging the calls leaves that in place.

#### How does PR #1333 split, and in what order? ([ENG-2165])

- **Answer:** [ENG-2061] first, then [ENG-1824]. The rest of the split is written when someone picks up [ENG-2165], with Michael reviewing. (Sid, 2026-10-22)

#### Do the items PR #1333 deferred get tickets? ([ENG-2165])

- **Answer:** Yes, as two bug tickets outside this milestone: Roam sync misses edits to a node type's child blocks, and published nodes whose description comes from their first child block need two Content variants. (Confirmed)

#### What does ENG-2061 cover? ([ENG-2061])

- **Answer:** It's the first step of [ENG-2165] and only removes `RoamFullContentNode`, as PR #1333 did. The full-content query returning `CrossAppNode` directly, and `RoamDiscourseNodeData`, are later steps if wanted. (Confirmed)
- **Options on record:** First sub-ticket, part of one change, or close it as a fair row type ([ENG-2061]'s ticket text). Michael: "It is basically the same type, different name" (PR #1243, 2026-07-22).

#### Is ENG-1986 a step of ENG-1823, or does it replace it? ([ENG-1986], [ENG-1823])

- **Answer:** Neither. [ENG-1986] is separate and comes later, before Obsidian moves onto the route. [ENG-1823] stays a small change. (Confirmed)
- **Reason:** Obsidian has one write path, so it has no drift to fix now. Its move onto the CrossApp types pays off with the route, and it checks that the CrossApp types are complete.
- **Also answered:** "If we drop the route, do we still do this?" doesn't apply, because the route stays. "Does ENG-1985 still block ENG-1986?" No: [ENG-1986] needs the CrossApp-to-database converters, and all six are on main.

#### Which Obsidian fields must the CrossApp types cover? ([ENG-1986])

- **Answer:** Open, needs Marc-Antoine.
- **Candidates:** `importedFromRid` (possibly `CrossAppBase.rid`); colour and format on relation types; the Concept name. Obsidian names each Concept by file path, while the shared converter uses the title, and Concept names are unique within a space. From reading the code, two notes with the same title in different folders would collide.

#### What does discovery return? ([ENG-2091])

- **Answer:** `CrossAppNode`, with the missing fields added; `SharedNode` is removed. The ticket's Solution and Done When settle it.
- **Options on record:** `CrossAppNode` (Michael, 2026-07-22: "eventually should be CrossAppNode contract"; Marc-Antoine's Solution, 2026-08-03). Keep `SharedNode` as a lightweight listing (Sid, 2026-07-20). A listing type that wraps a `CrossAppNode` (the ticket's example), and a separate lookup of spaces (raised in the 2026-10-22 review); both dropped because they keep `SharedNode` under another shape.
- **Reason:** It's the ticket's plan and the team's direction. Sid's point about a light listing still holds: `content.full` is optional, and import fetches full content on its own.

#### Which fields does CrossAppNode gain? ([ENG-2091])

- **Answer:** `spaceId` in `CrossAppBase` (Michael, 2026-08-07: "#decided to add spaceId to CrossAppBase"), plus `spaceName`, `platform` and `directMetadata`. The other `SharedNode` fields already exist in another form: `localId`, `rid`, `content.direct.value`, the author's local id, `nodeType`, the dates and `slots`. (Confirmed)

#### What did "sourceId" mean? ([ENG-2091])

- **Answer:** Open, needs Marc-Antoine.

#### Which ticket builds the database-to-CrossAppNode converter for nodes? ([ENG-2091], [ENG-1985])

- **Answer:** [ENG-1985]. Its Done When covers all schemas, and only nodes are missing from `dbToCrossAppConverters.ts`. [ENG-2091] uses it. (Confirmed)

#### Does ENG-2045 wait for ENG-2091? ([ENG-2045])

- **Answer:** It follows [ENG-2091]. Its Done When already allows "the agreed cross-app return type".

### Relations

#### Do we still need ENG-1866? ([ENG-1866])

- **Answer:** No. It closes, and its block on [ENG-1874] comes off. (Confirmed)
- **Reason:** The validation it asked for happened elsewhere. Roam imports Obsidian's relations through the CrossApp converters ([ENG-1867], [ENG-2340]), the converter tests cover both forms of triple schema and endpoints in other spaces, and the one mismatch found (Obsidian relations point at a relation type, not a triple) is handled by a shared matching rule ([ENG-2373]). [ENG-1863]'s promised fixtures never landed; they'd come back only as a regression test.

#### How does Obsidian find relations made elsewhere between its own nodes? ([ENG-2394])

- **Answer:** The way Roam does: on every import and every refresh. (Sid, 2026-10-22)
- **Options on record:** Refresh-all, a dedicated check, or another explicitly scoped trigger ([ENG-2394], Michael, 2026-10-13). Background polling stays undecided, because the project excludes it from MVP0.
- **Reason:** No new command to learn, the two apps behave the same, and Obsidian already skips relations it holds.
- **Details (Confirmed):** the lookup runs once per refresh, even when nothing is imported; a notice says how many relations were imported; the smallest change adds the vault's own published nodes to the existing "relations that reference these nodes" query.
- **Reproduction, from reading the code:** only Obsidian fails this way, and only when user A has imported nothing from user B's space. Michael can confirm that the 2026-10-08 report matches.

## Risks / Trade-offs

- [Roam sync and publish keep two conversions until [ENG-2165] lands] → [ENG-2202]'s parity test stays; [ENG-2166] stays in Icebox until then.
- [Obsidian's single write uses today's converters and gets reworked by [ENG-1986]] → Accepted; [ENG-1823] is small.
- [Inline vectors may push a route request past the platform's size limit] → Settled in the embeddings decision for [FEE-890]; batch size is part of the route's design.
- [Moving Roam publish onto the route adds a dependency on the website] → Weighed in the follow-up tickets after [FEE-890].
- [A space nobody opens keeps half-written nodes] → Accepted; no migration.
- [Obsidian's wider relation lookup adds a query to each refresh] → The smallest change extends an existing query.
- [Most answers are Sid's, and Michael and Marc-Antoine haven't weighed in] → `Decision:` comments on each ticket and two decision films; tickets move between milestones only after that.

## Migration Plan

No schema change and no data migration. Order of work:

1. [ENG-1823] and [ENG-2061], in parallel.
2. [ENG-1824], then the rest of [ENG-2165]'s split; [ENG-2166] closes when it's done.
3. [ENG-1985], then [ENG-2091], then [ENG-2045].
4. When someone picks up [FEE-890]: decide its open details, then build it with [ENG-2005] and [FEE-891], then create the tickets that move sync and publish onto it. [ENG-1986] comes before Obsidian moves.

[ENG-1791]: https://linear.app/discourse-graphs/issue/ENG-1791
[ENG-1793]: https://linear.app/discourse-graphs/issue/ENG-1793
[ENG-1794]: https://linear.app/discourse-graphs/issue/ENG-1794
[ENG-1822]: https://linear.app/discourse-graphs/issue/ENG-1822
[ENG-1823]: https://linear.app/discourse-graphs/issue/ENG-1823
[ENG-1824]: https://linear.app/discourse-graphs/issue/ENG-1824
[ENG-1863]: https://linear.app/discourse-graphs/issue/ENG-1863
[ENG-1866]: https://linear.app/discourse-graphs/issue/ENG-1866
[ENG-1867]: https://linear.app/discourse-graphs/issue/ENG-1867
[ENG-1874]: https://linear.app/discourse-graphs/issue/ENG-1874
[ENG-1909]: https://linear.app/discourse-graphs/issue/ENG-1909
[ENG-1985]: https://linear.app/discourse-graphs/issue/ENG-1985
[ENG-1986]: https://linear.app/discourse-graphs/issue/ENG-1986
[ENG-2005]: https://linear.app/discourse-graphs/issue/ENG-2005
[ENG-2045]: https://linear.app/discourse-graphs/issue/ENG-2045
[ENG-2061]: https://linear.app/discourse-graphs/issue/ENG-2061
[ENG-2091]: https://linear.app/discourse-graphs/issue/ENG-2091
[ENG-2165]: https://linear.app/discourse-graphs/issue/ENG-2165
[ENG-2166]: https://linear.app/discourse-graphs/issue/ENG-2166
[ENG-2202]: https://linear.app/discourse-graphs/issue/ENG-2202
[ENG-2340]: https://linear.app/discourse-graphs/issue/ENG-2340
[ENG-2373]: https://linear.app/discourse-graphs/issue/ENG-2373
[ENG-2394]: https://linear.app/discourse-graphs/issue/ENG-2394
[ENG-2412]: https://linear.app/discourse-graphs/issue/ENG-2412
[ENG-2413]: https://linear.app/discourse-graphs/issue/ENG-2413
[FEE-890]: https://linear.app/discourse-graphs/issue/FEE-890
[FEE-891]: https://linear.app/discourse-graphs/issue/FEE-891
