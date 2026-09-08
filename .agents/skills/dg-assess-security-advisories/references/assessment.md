# Assessment procedure

## Snapshot and selection

Use an authenticated GitHub connector or CLI for the requested repository. Paginate all results; do not count only the first page. Record open totals by severity, snapshot time, and exact selected IDs.

```sh
gh api --paginate --slurp 'repos/DiscourseGraphs/discourse-graph/dependabot/alerts?state=open&per_page=100'
```

`--slurp` produces an array of pages. Flatten before filtering. Some gh versions do not combine `--slurp` with `--jq`; sort locally when needed. On Windows, use explicit UTF-8 when saving JSON rather than relying on shell redirection defaults.

Use the user's requested ordering. If none is supplied, the previous batch convention is descending alert number within severity. Say this is a batch order, not an exploitability ranking. Exclude prior reviewed numbers, including reviewed alerts still open, when selecting the next batch.

Record each alert's number, URL, state, GHSA, package, manifest, vulnerable range, and first patched version. Resolve installed versions from the lockfile. Preserve duplicate entries across manifests and major versions, while sharing evidence where justified.

## Reachability evidence

Record the main commit SHA and source links pinned to it. Distinguish the checked-out branch from main and report relevant differences. Never silently reuse a stale local installation as evidence of main's dependency graph.

For each alert, answer:

| Question                      | Evidence to collect                                                                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why is the package installed? | Workspace root, direct parent, complete transitive path, dependency category, and resolved versions. Include auto-installed peers; `pnpm why` alone may miss them.                                          |
| What is vulnerable?           | Advisory mechanism, affected function/options, input requirements, and first patched version. Read the affected implementation where needed.                                                                |
| Do we execute that function?  | App/build entry points, callers and arguments, imports, feature configuration, and relevant dependency source. An import or devDependency label alone is insufficient.                                      |
| Who controls the input?       | Customer, group member, repository contributor, build configuration, downloaded archive source, or fixed code values. Follow input through transformations to the vulnerable call and relevant output sink. |
| What could happen?            | Concrete confidentiality, integrity, or availability impact in that process. Do not infer data theft from a CPU-exhaustion advisory.                                                                        |
| What remains uncertain?       | Missing source, unavailable environment, assumptions, confidence, and the smallest verification step that would change the decision.                                                                        |

Check host-provided globals and build externalization. For example, upgrading a package does not replace `window.CryptoJS` if the Roam build maps imports to that global. Distinguish package code from a host-loaded implementation.

Separate product runtime, developer/build/install tooling, and unused paths. Tooling can still process hostile input; it is not automatically safe. For archive extraction, identify the archive source and extraction method. For glob denial of service, distinguish a malicious pattern from a filename matched against a fixed pattern.

For shared content, record membership controls and recipient actions. Admin-approved membership narrows access but does not prevent a malicious or compromised member from submitting executable content. Keep a local parser reproduction separate from a complete cross-user exploit in the host app.

Use harmless, bounded probes in a local scratch directory. Avoid exhaustion payloads, production mutations, or testing against other users. State exactly what the probe proves.

## Parent versions and alternatives

Inspect both the installed parent's package manifest and current published metadata. Check whether the latest parent release actually changes or removes the affected dependency; a newer parent is not proof of a fix.

```sh
npm view <parent>@latest version dependencies optionalDependencies engines --json
```

Follow optional/platform packages when a packaging change may move the dependency. Determine whether we use the parent itself, just a different feature of the parent, or neither.

Compare these options:

1. Refresh targeted lockfile resolutions if existing parent ranges allow the patched version.
2. Upgrade a used parent, with validation of its affected workflows.
3. Remove an unused direct dependency if its consumers and scope justify that change.
4. Use a version-scoped override only when necessary and authorized.
5. Recommend no action or explicit acceptance of residual risk with evidence.

Exact pins and compatible ranges require different explanations. An override installs a published replacement package; it is not a source patch. Scope it to affected versions within an existing major when compatible. Record the parent, reason, and removal check: remove the override, refresh relevant lockfile entries, confirm affected versions do not return, and validate. Broad parent ranges can keep matching an override and hold the selected version; it does not clean itself up.

Avoid global major overrides, speculative parent upgrades, and unrelated lockfile churn. A grouped tooling PR is reasonable only when the changes are compatible, useful, and approved together.

## Report checks

For batch reports, include counts, the reviewed SHA, all selected alerts, source evidence, limitations, options, proposed comments, and separate final decision/state fields. A recommendation is not an executed action.

Copy `assets/report.html` to repository `local/`, replace its example card, and create one card per selected alert. Escape untrusted advisory/source text and URLs before insertion. Use only intended HTTPS links and escaped text; never embed executable input from an advisory or note. The report itself must remain self-contained.

Verify counts against the snapshot, search/filter/reset behavior, internal links, HTTPS link targets, browser errors, and mobile overflow. Keep raw authenticated API responses local. Put the durable rationale in the ticket so future work does not depend on ignored local files.
