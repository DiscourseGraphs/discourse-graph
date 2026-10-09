# Reusable templates

Replace angle-bracket fields with the current batch's evidence. These are drafting templates, not payloads ready to submit. Use the engineering ticket skill for current team/project/status/label selection.

## Assessment ticket

```markdown
## Problem

- Assess <selection> Dependabot alerts for actual exposure. Severity alone does not establish risk to our applications.

## Solution

- Trace dependency paths, vulnerable calls, inputs, and current parent-package options against main <sha>.
- Save a reviewable HTML report under repository local/ with recommendations and proposed comments.

## Done When

- Every selected alert has evidence, prerequisites, impact, confidence, limitations, and a concrete recommended action.
- The owner has a reviewable result before any action requiring approval; no unapproved mutation is performed.

## Out of Scope

- <Prior batch IDs, adjacent fixes, and excluded mutations.>

## Notes

- Snapshot: <time>. Selection: <ordering and exclusions>. This is not an exploitability ranking.
- <Table of alert links, packages, GHSA identifiers, and manifests.>
```

## Per-alert evidence record

```markdown
Alert: <number/link>; GHSA: <id>; snapshot state: <state>
Package / manifest / installed versions: <values>
Affected range / first patched version: <values>
Reviewed main: <sha>; dependency path: <workspace -> parents -> package>
Environment and actual use: <runtime, build/install tooling, unused, or unresolved>
Vulnerable call and input: <source links and arguments>
Attacker prerequisites and recipient action: <concrete conditions>
Likely impact: <what happens in our process>
Evidence/probe: <observation>; not tested: <limitations>
Parent options: <installed and latest versions, exact pin/range, actual use>
Recommendation / confidence: <action and why>
Proposed dismissal reason/comment: <if appropriate; not yet posted>
Owner decision: <pending or authorized decision with reference>
Execution: <not performed, fixed, dismissed, deferred, or failed; time and verification>
Revisit condition / follow-up: <what would change this assessment>
```

## HTML report

Copy [report.html](../assets/report.html). Fill the overview from the snapshot and use the evidence record to populate each card. Keep proposed actions separate from actual outcomes. The report can link to source and tickets, but needs no external script, font, or stylesheet to function.

## Dismissal comments

Unused path:

> <Consumer> calls <safe invocation>; no inspected path supplies <required malicious input> to <vulnerable function>. Main <sha>. ENG-<id>.

Accepted risk:

> Risk accepted by <owner>: <reachable tooling/input condition and impact>. Revisit <condition>. ENG-<id>.

Shorten to the API's current limit without losing the reason. Do not truncate mechanically or reuse a vague comment across different mechanisms.

## Accepted-risk decision

```markdown
The owner accepted <specific exposure> for <alert IDs> because <prerequisites, impact, and maintenance tradeoff>.

<PR link> was <closed without merging / not created>. No fix was shipped.
Alerts <IDs> were <verified dismissed with tolerable_risk / left open pending approval>.
<Separate findings> remain tracked in <ticket/alert>. Revisit when <condition>.
```

## Remediation child ticket

```markdown
## Problem

- <Alerts> affect <used dependency paths> through <mechanism>.

## Solution

- <Smallest justified update or mitigation>; <parent/pin constraints>.

## Done When

- <Target behavior or safe versions> verified on every affected dependency path.
- Required installation, tests, and GitHub checks pass; any override has a removal criterion.

## Out of Scope

- <Adjacent vulnerabilities or unrelated major upgrades.>

## Notes

- Parent assessment: <link>. Approved scope: <decision reference>.
```

## Next-batch ticket

Reuse the assessment template with fresh open alerts. Specify the number/severity, ordering, excluded prior alert IDs, and a link to the preceding assessment. Add the requested owner and absolute due date. Do not copy the previous batch's conclusions or approval.
