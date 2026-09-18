# Decisions and execution

## Choose the action

| Finding                                                                   | Recommendation                                      | GitHub dismissal reason, if approved                              |
| ------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| Evidence shows the vulnerable function or required invocation is not used | Dismiss with the actual call-path evidence          | `not_used`                                                        |
| A path exists, but the owner accepts the remaining exposure               | Record the prerequisites, impact, and accepted risk | `tolerable_risk`                                                  |
| A useful tooling fix is justified                                         | Schedule or implement the scoped update             | Leave open until fixed or explicitly accepted                     |
| Untrusted product content reaches the vulnerable behavior                 | Propose a fix or mitigation and verification        | Leave open unless the owner explicitly accepts this specific risk |
| Evidence is incomplete                                                    | Explain the uncertainty and next check              | Do not infer dismissal                                            |

Low risk, unused code, fixed code, and a deferred fix are different states. Preserve the distinction in GitHub, Linear, and the report.

## Approved dismissals

Before mutating, confirm authorization covers the exact alerts and action. Re-read alert state/identity, GHSA, affected dependency/range, and the reviewed source baseline. If main or dependency metadata changed, determine whether the evidence still holds. Reassess material changes before applying a stale decision.

Use an individual comment containing the input/call-path rationale, relevant assumptions, and ticket reference. GitHub accepted a maximum of 280 characters during the September 2026 review; confirm the current API constraint and validate each comment before submission. Keep the full evidence in the ticket/report.

Example request body, only after approval:

```json
{
  "state": "dismissed",
  "dismissed_reason": "not_used",
  "dismissed_comment": "No caller supplies a variable generation size; inspected calls use default/fixed positive lengths. Main <sha>. ENG-<id>."
}
```

Submit sequentially through the authenticated connector or `PATCH /repos/{owner}/{repo}/dependabot/alerts/{number}`. Stop on an unexpected error rather than continuing an unverified batch. For an ambiguous response, read the alert before retrying. Never assume a failed response means no mutation occurred.

Verify each persisted state, reason, and exact comment with fresh reads. Record successes and failures individually. Return at least one direct alert link so the user can inspect its activity history. Use the dismissal's comment field; do not promise a separate GitHub advisory discussion comment.

## Approved remediation

Use the engineering ticket skill to create a scoped child issue when requested. Record affected alerts, target versions, parent constraints, and excluded adjacent work. Use its generated branch name and the repository's PR conventions.

Run the required frozen installation and repository validation. If validation fails, investigate whether the change caused it; reproduce a suspected baseline failure rather than labeling it pre-existing without evidence. Keep material validation limitations clear and wait for required GitHub checks after opening/updating the authorized PR.

Do not broaden a small dependency update into unrelated fixes. Explain override maintenance and removal criteria before proposing it. Successful tests do not establish that a low-value override is worth maintaining.

## Acceptance, deferral, and closure

If the user chooses risk acceptance after a PR exists, close it without merging only when authorized. Record the decision and rationale on the original assessment issue. Close the abandoned implementation ticket using an appropriate status such as Won't Fix, without presenting it as shipped remediation.

Mark the assessment Done when its review and decisions are complete. A deferred vulnerability may remain open with an explicit linked owner/work item. Update report decisions, comments, counts, and timestamps after execution; keep the original assessment snapshot distinct from current state.

For deferred work, find a matching existing ticket before proposing a new one. Check its actual scope and fallback paths. Adding ATJSON storage does not remove existing Markdown parsing; acceptance criteria must cover executable frontmatter and legacy import paths explicitly.

Create a next-batch ticket only when requested. Exclude the previous batch, state the ordering, and set the requested assignee/date in the user's timezone. A due date is not proof that a reminder notification was scheduled; report which action the available tool actually performed.

## Operational notes

Never expose credentials in reports, commands, or examples. Use structured connector inputs or UTF-8 request/body files for multiline text. JSON serialization is not shell escaping. In PowerShell, convert file content to a plain string before serializing it; file-content objects can carry metadata.

If a gh PR-edit command fails on a deprecated GraphQL field, an authenticated REST update is an alternative. Verify current state before retrying any ambiguous write. Tool names and API constraints can change; use currently available documentation instead of depending on a historical CLI error.
