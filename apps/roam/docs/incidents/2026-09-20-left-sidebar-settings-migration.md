# Roam personal settings and left sidebar migration incident

Date: 20 September 2026. Times below are UTC unless specified.

Scope: one shared Roam team graph. Users and graph blocks are anonymized in this repository copy.

Investigated build: `0.23.0-2026-09-20-left-sidebar-debug-3a1af547`, commit `3a1af547d0c959a57f5d4bdd0dadc5300348e94a`.

Status as of the post-handoff diagnostic at `2026-09-20T11:39:37.148Z`: it shows the expected sidebar section counts for all ten captured users. The current user's complete props comparison confirms that only `Left sidebar` changed. The complete live recovery report for all users has not yet been supplied. The production checkbox and migration defects remain unfixed in the inspected code.

## Findings

The incident exposes two interacting defects in the Roam extension:

1. Enabling the left sidebar can create a blank configuration block named `Left Sidebar`, because the checkbox uses its display label as its legacy storage key. The lookup still expects `(BETA) Left Sidebar`.
2. Migration can overwrite valid props with a different legacy value without establishing that the legacy source is complete or authoritative. If the legacy reader selects the blank duplicate, migration can replace a populated sidebar array with `[]` and mark migration complete.

V2 did not introduce the overwrite rule. It changed the migration markers and made previously migrated installations eligible to run the rule again. It also changed the personal read path to use legacy settings until the current user's V2 marker is complete.

Both defects were reproduced with the actual relevant extension code and mocked Roam storage. The captured graph had exactly the duplicate-root structure that can trigger this path. However, the earliest supplied diagnostic already contained an empty personal sidebar array. It does not show the historical write that first emptied that array. The reproduced mechanism is consistent with the incident; it is not a complete historical replay for every affected user.

A separate startup path also deserves correction: if one field makes a settings group fail schema validation, initialization writes defaults for the entire group. The captured personal props pass validation, so this is an additional risk rather than an established cause of this incident.

## Observed impact

The complete snapshot at `2026-09-20T11:12:49.473Z` contained ten personal props blocks and one exact `Left Sidebar` configuration root. It also contained the separate `(BETA) Left Sidebar` enable marker.

Across the legacy personal sidebar trees, the snapshot contained 28 sections and 166 item entries. Personal props contained eight sections and 42 item entries. Five users had empty sidebar props while their legacy trees retained 20 sections and 124 item entries.

An item entry is a stored occurrence, not necessarily a unique page or block. The proposed recovery script is designed to preserve order, repeated entries, commands, references, and aliases. Users are labeled A through J in snapshot order; User G is the reporter.

| User         | Legacy sections / items | Props sections / items before repair | Props sections in latest diagnostic |
| ------------ | ----------------------: | -----------------------------------: | ----------------------------------: |
| A            |                   1 / 5 |                                1 / 5 |                                   1 |
| B            |                 11 / 70 |                                0 / 0 |                                  11 |
| C            |                  2 / 10 |                               2 / 10 |                                   2 |
| D            |                  3 / 10 |                                0 / 0 |                                   3 |
| E            |                   0 / 0 |                                0 / 0 |                                   0 |
| F            |                  2 / 17 |                                0 / 0 |                                   2 |
| G (reporter) |                  3 / 11 |                                0 / 0 |                                   3 |
| H            |                  1 / 16 |                                0 / 0 |                                   1 |
| I            |                  2 / 15 |                               2 / 15 |                                   2 |
| J            |                  3 / 12 |                               3 / 12 |                                   3 |

The current user's recoverable sections were Meetings with four items, Personal with one item, and Projects with six items. The legacy parent and personal props destination were distinct blocks and were identified explicitly in the recovery plan.

The four already-populated props arrays contained the same sections, item order, targets, and aliases as their legacy copies. Three arrays matched completely. One had a different section folded state. The user empty in both stores has no recoverable sidebar entries in this snapshot.

The private comparison artifact retains the full identities and source/destination mapping. Raw graph captures and recovery payloads are not included in this documentation commit.

## Storage and migration markers

Several similarly named objects serve different purposes:

| Object                             | Location                                      | Purpose                                                                          |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| `(BETA) Left Sidebar`              | Top-level block on `roam/js/discourse-graph`  | Legacy boolean enable marker.                                                    |
| `Left Sidebar`                     | Top-level block on the same page              | Container for legacy shared and per-user sidebar configuration.                  |
| `<user UID>/Personal-Section`      | Child of the legacy `Left Sidebar` root       | That user's sections, items, aliases, and section settings.                      |
| `<user UID>`                       | Separate top-level block on the settings page | That user's personal settings stored in block props.                             |
| `Left sidebar`                     | Property on the personal settings block       | Current personal sidebar section array.                                          |
| `Block props migrated v2`          | Visible block on the settings page            | Graph-level migration completion marker.                                         |
| `dg-personal-settings-migrated-v2` | Current user's extension settings             | Personal migration completion marker. It is not a property on their graph block. |
| `Props settings default migrated`  | Property on `Feature Flags`                   | Tracks the step that enables the new settings store by default.                  |

Removing the graph-level marker reruns migration for shared settings and discourse-node configuration. It does not reset personal migration for all users. Resetting the personal extension setting would rerun the current user's full personal migration only. Removing the default-store flag only reruns the default-enable step after the migration prerequisites succeed.

The current user's raw props contained both `:Left Sidebar: {}` and `:Left sidebar: []`. These are different property names. The normalizer removes leading colons but preserves capitalization. The current schema reads `Left sidebar`; the differently capitalized property is not a backup or fallback.

Sources: [marker definitions](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/migrationMarkers.ts#L1), [personal schema](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/zodSchema.ts#L237), [props normalization](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/utils/getBlockProps.ts#L21), and [default-store migration](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/migratePropsStoreDefault.ts#L9).

## Failure mechanism

### The enable control writes the wrong legacy block name

`GeneralSettings` looks up `(BETA) Left Sidebar` to obtain the enable marker's UID. It supplies `Left Sidebar` as the checkbox's display title. `BaseFlagPanel` uses that title as the block string when it needs to create a marker.

If the expected marker is absent, enabling the feature creates a blank `Left Sidebar` at order 2. The operation does not check for or reuse the populated configuration root farther down the page because it is creating what the control considers a boolean marker.

Reopening the settings panel can repeat the lookup failure because the newly created block still does not have the expected `(BETA)` name. A subsequent enable can create another duplicate. When the correct `(BETA)` marker exists, enabling can reuse it; disabling and enabling again still exposes the naming defect because disabling removes the marker.

This mismatch was introduced by [commit `2592a6c4`, “Remove (BETA) label from Left Sidebar feature”](https://github.com/DiscourseGraphs/discourse-graph/commit/2592a6c4df29cda99de1c174b290767c57663a6f), committed on 12 May 2026 UTC. The change intended to modify the UI label while keeping legacy lookups, but the writer also depended on the label.

Sources: [lookup](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/GeneralSettings.tsx#L37), [checkbox arguments](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/GeneralSettings.tsx#L70), and [create/delete implementation](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/components/BlockPropSettingPanels.tsx#L205).

### The legacy reader selects the first exact root

`getLeftSidebarSettings` uses the first tree node whose text is exactly `Left Sidebar`. The configuration tree is ordered by block order. It does not search other roots when the selected root lacks the current user's sections.

The first supplied capture showed:

| Root   | Order | Current user's legacy sections                                               |
| ------ | ----: | ---------------------------------------------------------------------------- |
| Root A |     2 | No matching personal section block. This root was selected.                  |
| Root B |     3 | Matching personal section block, but no sections.                            |
| Root C |     4 | No matching personal section block.                                          |
| Root D |    20 | Meetings, Personal, and Projects under the populated personal section block. |

Both the ordered live tree and the cached configuration selected Root A. The raw pull happened to list the populated root first, but raw pull order was not the reader's effective selection order.

This explains why changing the duplicate block names made legacy settings visible again. It also explains why the data could remain on the page while the reader returned an empty sidebar.

Source: [root selection](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/utils/getLeftSidebarSettings.ts#L299).

### Migration overwrites props with the selected legacy result

`shouldWrite` returns true when current props are invalid, or when their serialized value differs from the parsed legacy value. It does not check whether the legacy reader selected a complete source or whether current props were already in active use.

The migration passes all parsed settings in the group to `setBlockPropsAsync`. That helper preserves unrelated top-level keys, but keys supplied by migration replace existing values. A supplied `Left sidebar: []` therefore replaces the entire existing array.

The V2 change, [commit `8a6d5379`, “Enable props-based settings by default”](https://github.com/DiscourseGraphs/discourse-graph/commit/8a6d5379f64d6f375c77813d7e1da7a81e756fa1), committed on 6 September 2026 UTC, changed both graph and personal marker names. Old completion markers no longer prevented the new migration from running. The overwrite decision itself was unchanged.

Sources: [overwrite decision](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/migrateLegacyToBlockProps.ts#L50), [migration write](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/migrateLegacyToBlockProps.ts#L94), [props merge](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/utils/setBlockProps.ts#L22), and [personal migration](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/migrateLegacyToBlockProps.ts#L292).

### Completion preserves the empty result

An empty sidebar array is valid under the current schema. After successful migration, the personal V2 marker is set to true. With the new settings store enabled, subsequent reads use personal props. Sidebar configuration construction uses those values; it does not substitute a populated legacy array when props contain `[]`.

Before the V2 marker is complete, startup reads personal settings from legacy even if props mode is enabled. This creates two possible visible regressions: temporarily reading the wrong legacy root before migration, and retaining empty props after a migration writes them.

Sources: [read selection](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/accessors.ts#L898) and [sidebar configuration construction](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/utils/getLeftSidebarSettings.ts#L246).

### Dual writing did not guarantee recovery

Writing an edit to both legacy storage and props does not guarantee that a later reader will select the same legacy block. In this incident, populated legacy sections survived under another root. Migration ignored that root.

The two writes also do not constitute an atomic transaction or establish which copy is newer. The snapshot contains concrete folded-state differences, so treating either storage format as universally authoritative would discard some existing choices.

## Timeline and limits of historical evidence

| Time                           | Evidence                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12 May 2026 UTC                | The UI-label change introduced the enable-marker naming mismatch.                                                                                                         |
| 1 June 2026, 10:51:01.984      | Creation time of this graph's old `Block props migrated` marker.                                                                                                          |
| 6 September 2026 UTC           | The V2/default-store change was committed.                                                                                                                                |
| 8 September 2026, 13:21:25.995 | Creation time of this graph's `Block props migrated v2` marker in the initial capture.                                                                                    |
| 20 September, 09:46:38.416     | Startup diagnostic: props mode enabled, personal V2 false, current user's stored sidebar already empty, duplicate roots present.                                          |
| 20 September, 09:46:38.552     | After-initialization diagnostic: personal V2 true, read source switched to props, stored sidebar still empty.                                                             |
| 20 September, 11:12:49.473     | Complete ten-user snapshot: five empty props arrays with populated legacy sources; one exact configuration root remains.                                                  |
| 20 September, 11:39:37.148     | Latest diagnostic after the console recovery handoff: all ten props section counts match legacy counts; current user's three sections are present and read by the plugin. |
| 20 September, 11:43:25         | Public Depot metadata rechecked: it still points to version 0.22.0 at `35ac77ee`.                                                                                         |

Marker creation timestamps date those marker blocks. They do not date the write to an individual user's `Left sidebar` property. A personal settings block's last-edit time also cannot identify which property changed.

The first captured startup did not show a transition from populated props to empty props. Its raw sidebar props were already empty. We therefore cannot attribute the original loss to that specific run, date the loss for every user, or prove that every empty array in the graph was produced by this exact sequence.

The early diagnostics also showed a non-sidebar difference for `Reified relation triples`: legacy/effective true and stored props false before initialization, then false in both readers afterward. The stored props remained false. This establishes a read/legacy-state difference, not a demonstrated destructive props write to that setting.

## Exposure across releases and graphs

At `2026-09-20T11:43:25Z`, the public [Roam Depot metadata](https://github.com/Roam-Research/roam-depot/blob/main/extensions/DiscourseGraphs/discourse-graph.json) pointed to `35ac77eefd1dd952375b31d972df4b74332cacaf`. The [package at that commit](https://github.com/DiscourseGraphs/discourse-graph/blob/35ac77eefd1dd952375b31d972df4b74332cacaf/apps/roam/package.json) is version 0.22.0. The V2 commit is not an ancestor of that release.

| Build                          | Confirmed code exposure                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Published Depot 0.22.0         | Marker naming defect, first-root selection, original migration overwrite rule, and whole-group initialization defaults. No V2 marker rerun. |
| Inspected `main` at `51e2b924` | Includes the V2 change as well as the underlying defects.                                                                                   |
| Debug build `3a1af547`         | Includes the V2 change and diagnostics. This is the build recorded in the supplied logs.                                                    |

The relevant paths have no restriction to the investigated team graph. A single-user graph can encounter them. In a team graph, one person's enable action can create a duplicate root that changes the legacy source subsequently read by other users.

Installed version, existing marker state, user actions, source contents, and timing determine exposure. Different users in the same graph can therefore retain different props contents. The supplied data does not contain each teammate's private extension migration settings or their execution history, so it does not establish the reason for each individual outcome.

Public Depot metadata identifies the published source commit. It does not show which build every user has loaded, including older installs or custom branch builds. No fleet-wide affected-user count has been established.

The release verification was retained locally with the metadata response and inspected package version. The public metadata and pinned package links above provide the repository-accessible references.

## Potential impact on other settings

| Settings group                                                  | Relevant failure path                                                                                                                                                   | Current evidence                                                                                                                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal sidebar                                                | Wrong root can produce an empty array; migration can overwrite props.                                                                                                   | Five recovery candidates found in this graph; mechanism reproduced.                                                                                                                             |
| Shared sidebar and each user's global-section folded preference | Legacy values are read from the same selected root.                                                                                                                     | Same source-selection exposure. Two folded-state disagreements observed. Shared props were not included in the final supplied all-user snapshot.                                                |
| Other personal settings                                         | Personal migration copies the full personal group from legacy sources, many of which use the current user's extension settings and defaults.                            | Actual migration reproduced overwriting a custom query page size, query-page list, keyboard shortcut, and boolean preference. These were fixture values, not confirmed losses in this graph.    |
| Global settings                                                 | Graph migration copies legacy global configuration through the same writer. This includes export settings, canvas page format, suggestive-mode settings, and relations. | Exposure established by source inspection. No complete before/after capture establishes loss in these groups here.                                                                              |
| Discourse-node settings                                         | Graph migration reconstructs node configuration from legacy trees and uses the same writer.                                                                             | Exposure established by source inspection. A guard skips unreadable legacy data when existing node props are valid; readable but incomplete/default-bearing data still needs careful treatment. |
| Any initialized top-level settings group                        | An invalid field can cause initialization to write defaults for the whole configured group.                                                                             | Additional source-confirmed risk. All ten captured personal props passed the current schema.                                                                                                    |

The isolated migration reproduction changed a valid page size from 37 to 10, replaced a custom query-page list with the default, cleared a shortcut, and changed a boolean from true to false when migration used legacy defaults. The same fixture preserved these settings when the relevant completion marker caused migration to skip.

Source: [whole-group initialization](https://github.com/DiscourseGraphs/discourse-graph/blob/3a1af547d0c959a57f5d4bdd0dadc5300348e94a/apps/roam/src/components/settings/utils/init.ts#L149). The local reproduction results are summarized in the verification table below.

This investigation concerns Discourse Graphs settings in the Roam extension. It does not establish damage to other installed plugins, the Obsidian plugin, or the main content of the graph. The recovery snapshot deliberately excluded GitHub Sync credentials and did not audit them.

## Recovery handoff and post-recovery observations

A standalone console script was generated from the reviewed snapshot. It targets the ten known personal props blocks and plans writes only for the five users whose props arrays were empty and whose legacy arrays were populated.

The script is designed to perform these steps:

- Confirm the graph name, settings-page UID, single exact configuration root, and destination block identities.
- Capture and print full live props before writing.
- Compare the affected users' live legacy sections with the reviewed data.
- Stop before its first write if a proposed destination has become unexpectedly populated or a required source changed.
- Merge only `Left sidebar` into each destination's live props.
- Recheck each source and destination immediately before writing and verify each write by reading it back.
- Print full after props and a per-user changed-keys summary, including partial progress if a write fails.
- Retain reports in the browser session. A repeat run skips already-restored arrays.

The script does not provide an atomic transaction across all users. Roam's API path used here has no compare-and-swap operation. The immediate checks reduce the opportunity for a conflicting edit but cannot eliminate the gap between a read and a write. The script stops and reports partial progress rather than automatically rolling back over potentially newer edits.

The script is designed to preserve existing populated arrays. Specifically, User J has Dev Meetings expanded in props but folded in legacy. The proposed patch leaves that array untouched. The global-section folded differences for User B and User J are also outside the patch because the repair targets section arrays only. The latest diagnostic does not verify those users' complete post-recovery values.

### What the latest diagnostic reports

At `2026-09-20T11:39:37.148Z`:

- All five previously empty props arrays have the expected section counts.
- The other five users retain their previous section counts.
- All ten users' props section counts match their legacy counts.
- The current user's stored, legacy, effective, and component-config sections agree: Meetings (4 items), Personal (1), Projects (6).
- Comparing the current user's entire props object with the earlier snapshot finds exactly one changed key: `Left sidebar`.
- Props mode is enabled and the current user's personal V2 marker is true.
- The live and cached readers select the intended populated root (Root D).
- The diagnostic warnings array is empty.

### What remains unverified

- The latest attachment is a plugin diagnostic, not `window.dgSidebarRecoveryReport`. It does not contain the script's final status or its verified-write list.
- Other users' current full props and item arrays are not included in that diagnostic. Their section counts are verified; complete item-level and unrelated-property preservation still needs the script report or a new full snapshot.
- No teammate's visible sidebar has been verified in that teammate's session.
- The diagnostic reports `Enable left sidebar: false` despite a present sidebar component. That flag/UI disagreement remains unresolved. The recovery script does not write feature flags, and the supplied capture does not establish when the flag changed.
- The graph V2 marker is absent in the latest diagnostic. The repair does not recreate it. Reloading the current build would make graph-level migration eligible to run again.
- Production code has not been patched or released as part of this investigation.

The private post-recovery comparison records the per-user section counts and the reporter's full property difference. Its verified observations and limits are listed above.

## Verification work completed

| Check                                                  | Result and limit                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actual checkbox code in an isolated React/Roam fixture | Reproduced blank duplicate creation when the `(BETA)` marker was absent. Existing marker prevented creation. An in-memory title correction created the intended marker. No live graph mutation.                                                                                                          |
| Actual migration, schemas, and props writer            | Reproduced populated-to-empty overwrite when migration ran, and preservation when the relevant marker caused a skip. Also reproduced replacement of non-sidebar preferences by legacy defaults. No historical replay implied.                                                                            |
| Snapshot conversion                                    | All ten users' converted legacy data matched the actual legacy reader/converter. All 28 candidate sections and all ten existing personal props objects passed the current schemas.                                                                                                                       |
| Inventory utility tests                                | Three tests passed: preservation of complementary sources and aliases, distinction between missing/malformed/empty data, and preservation of duplicate occurrences.                                                                                                                                      |
| Generated console recovery tests                       | Nine tests passed, covering the five-user restore, all-user before/after output, repeat execution, changed sources/destinations, wrong graph and duplicates, preservation of newer unrelated preferences, partial failures, concurrent edits detected before a write, and failed read-back verification. |
| Live post-recovery evidence                            | Expected section counts observed for all ten users; complete current-user props difference verified. Full all-user write audit remains pending.                                                                                                                                                          |

Fixture tests establish behavior under modeled conditions. They do not replace live verification of each user's UI or prove the precise historical mutation that caused the incident.

## Rectification plan

The following changes are recommendations. They have not been implemented or adopted as a release policy in this investigation.

### Correct the writer before further rollout

Give the enable control an explicit, stable legacy storage key separate from its display label. Enabling and disabling must affect only the dedicated enable marker. Never pass the actual configuration root UID to a boolean control that deletes its block when unchecked.

Test existing markers, missing markers, repeated enable/disable cycles, reopening settings, and a populated root later in page order. Display-label changes must not change storage identities.

### Make migrations preserve established values

Use explicit versioned transformations. Define which source is authoritative for each version transition. Treat existing valid values, including `false`, `[]`, and `""`, as real user choices. Distinguish a missing property from a present property equal to a default.

Do not fill a record with defaults first and then use those defaults as evidence that migration completed. Do not replay an entire legacy group merely because a marker was renamed. Preserve unknown properties and valid unrelated fields when converting an incompatible field.

Separate initial migration from repair of previously damaged data. Mark the specific migration or repair complete only after successful writes and verification. Completion must be recorded at the appropriate scope; a graph marker cannot stand in for every user's private migration state.

### Resolve duplicate roots without discarding data

Inspect every exact root and map user sections to their sources. Reuse an unambiguous configuration root. If multiple roots contain populated or conflicting copies, retain them and present a comparison before reconciliation.

Automatically choosing the first or largest tree is insufficient. A smaller or empty configuration can reflect an intentional edit. A maximal union can resurrect removed entries. Use the existing inventory to distinguish recoverable omissions from unresolved conflicts.

Also detect duplicate top-level user props blocks. The inspected props reader retains the last matching block from a pull, while the writer selects the first match. The current ten-user capture has unique destinations, so that separate ambiguity was not observed here, but a migration should reject it before writing.

### Deliver a dedicated recovery path

For this graph, collect the full console report, resolve the separate enabled-state issue, and verify a teammate session. Keep the existing snapshot and recovery report as evidence of the before/after values.

For other graphs, provide a read-only diagnostic and a reviewable recovery plan. Identify empty props with populated legacy candidates, duplicate roots, incompatible schemas, and conflicting populated copies. Preserve explicit empty settings when intent cannot be established.

An all-user sidebar repair can read each user's graph-resident legacy sidebar tree. It must not obtain every user's other preferences by repeatedly calling the current user's legacy personal-settings accessor. Many of those values belong to the signed-in user's extension settings and would otherwise be copied into the wrong accounts.

### Correct startup sequencing

Initialize the sidebar and relevant listeners from a fresh snapshot after migration, or explicitly notify them of the migration result. The inspected startup creates observers before awaiting schema initialization and registers settings pull watchers afterward. A settings write during that interval is not sufficient proof that every already-mounted consumer has adopted the resulting values.

Verify the final feature flag, persisted props, component configuration, and visible sidebar together. The latest false enabled flag with a present component is an unresolved example requiring this check; it is not attributed to the recovery script by the available evidence.

### Establish affected scope and monitor the fix

Use existing `Extension Loaded` events to identify build commits and versions observed in active installations. Treat those events as exposure evidence, not proof of data loss.

Add diagnostics for root counts, migration versions, legacy/props section counts, proposed writes, skipped conflicts, and verified outcomes. Respect the existing diagnostics preference. Prefer counts, state, and error categories over transmitting sidebar content. Provide a local export for users without telemetry.

Absence of error reports does not establish safety. The current migration accepts `[]` and logs the write as a successful migration. A fleet-wide estimate needs source/props comparisons or equivalent recovery diagnostics, not exception counts alone.

I recommend fixing and verifying the writer and migration policies before broadly publishing the V2 rerun to Depot users. Use affected-graph fixtures and a controlled rollout with verification before expanding distribution.

## Acceptance criteria

- Enable/disable cycles create no duplicate configuration roots and never delete populated configuration data.
- Previously valid props remain unchanged when legacy data is missing, incomplete, or conflicting.
- Initial migration still works for genuinely missing settings.
- One invalid field does not reset unrelated valid fields.
- Recovery preserves section order, item order, aliases, repeated entries, commands, and explicit user settings.
- A repeat startup or repeat repair performs no unintended writes.
- A failed write does not produce a false completion marker. Partial progress remains inspectable.
- All-user sidebar repair keeps each user's source and destination separate and preserves unrelated props.
- The current user's sidebar and at least one teammate's sidebar are verified after reload and after enable/disable interaction.
- Release verification identifies the actual published build. Telemetry and local diagnostics distinguish exposed, conflicted, repaired, and verified states.

## Evidence retained for this investigation

Source-code links in this report are pinned to the inspected commit. Public release metadata is timestamped because its `main` reference can change.

The following graph captures were supplied privately and are retained outside the repository:

| Capture                         | Timestamp (UTC)         | Use in this report                                                                                 |
| ------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| Startup before migration        | 2026-09-20 09:46:38.416 | Marker state, empty stored props, duplicate roots, and selected source.                            |
| Initial sidebar configuration   | 2026-09-20 09:46:38.467 | Component configuration during startup.                                                            |
| After settings initialization   | 2026-09-20 09:46:38.552 | Personal marker transition and selected props source.                                              |
| Complete ten-user snapshot      | 2026-09-20 11:12:49.473 | Legacy/props inventory, recovery candidates, aliases, and folded-state differences.                |
| Post-handoff sidebar diagnostic | 2026-09-20 11:39:37.148 | Current section counts, reporter's props contents, root selection, and enabled-state disagreement. |

The derived comparison, inventory, proposed recovery patches, executable recovery script, fixture tests, and local reproduction results are also retained outside the repository. They contain graph-specific data or depend on private capture files. This documentation commit publishes their findings and limits; it does not publish those datasets or claim that the local fixture tests are part of repository CI.

No production-source change or plugin release was made as part of this report. The full live console recovery report remains outstanding.
