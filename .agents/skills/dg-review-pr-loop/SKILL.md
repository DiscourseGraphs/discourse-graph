---
name: dg-review-pr-loop
description: Run a bounded Codex review loop on an existing Discourse Graphs PR, fix clear in-scope bugs, and ask the invoker about findings that need a decision. Use only when explicitly invoked.
---

# PR review loop

Start with an existing PR. Review its feedback, fix in-scope bugs, and report what
remains. Do not create a PR, merge, release, or replace human final approval.
Respect the invoker's restrictions on external actions.

## Find the PR and ticket

Accept a PR, a Linear ticket, or both, plus optional `max_reviews` (default `3`).
Use a positive whole number for the limit.

- From a PR, find the Linear ticket in its description or comments.
- From a ticket, find its linked open PR.
- If there are multiple matches or the supplied PR and ticket conflict, ask the
  invoker which to use. If the Linear ticket cannot be found or read, stop and
  ask for it before requesting a review or making changes.

Read the ticket's `Solution`, `Done When`, and relevant accepted decisions to
determine scope. Use `Done When` as the acceptance boundary; `Solution` explains
how to meet it. If the scope is unclear, ask the invoker in the current thread.

## Request and wait for review

1. Read the PR's current base and head commits, existing Codex reviews, comments,
   and unresolved findings. Confirm the PR is open. Keep known findings until
   they are fixed and verified or the invoker decides their disposition.
2. Post a PR comment containing exactly `@codex review`. Record its link, the
   requested head SHA, request count, and a deadline 30 minutes after the request.
   Each posted review request counts toward `max_reviews`; polls do not.
3. Wait 5 minutes before the first check. If no completed response is available,
   check every 2.5 minutes until a response arrives or the deadline expires.
   Use bounded waits that let you report progress. At timeout, stop and report
   Codex as pending; silence, a reaction, or a running check is not a clean review.
4. Accept results only from the actual GitHub Codex reviewer and only when they
   identify, or can be reliably associated with, the current head SHA. Re-read
   base and head before acting or reporting completion. If either changed,
   reassess the diff and ignore stale clean results. Request review of the new
   head only if requests remain.

An explicit no-issues Codex response can end the loop early when it applies to
the current head and no known findings remain. Equivalent wording is fine; do
not wait for a duplicate formal review. A clean Codex result does not clear
unresolved findings from an earlier round or another reviewer.

## Address findings

Check each finding against the code and ticket rather than trusting its priority
or proposed fix alone.

- Automatically fix clear, valid P1/P2/P3 bugs within scope. Use the smallest fix.
  If a finding is invalid, explain why in a reply instead of making a change.
- Stop immediately for ambiguity, a safety risk, changed accepted behavior, or
  an out-of-scope request. Ask the invoker in the current thread, with the finding,
  ticket boundary, and proposed next action. Do not implement outside scope
  without their approval.
- For out-of-scope work, ask whether to create a follow-up ticket. If approved,
  use [dg-create-engineering-ticket](../dg-create-engineering-ticket/SKILL.md).
  Create it in `Ticket Draft`, link it in the review comment, and tell the invoker
  that the new ticket requires their review. Ticket creation is not permission
  to implement it.

After a fix, run the relevant regression and affected repository checks. If
verification fails or is unavailable, report the blocker and leave the finding
unresolved. Do not present it as fixed or successful.

When checks pass, commit and push the fix. Confirm the remote head includes it,
then reply to each fixed Codex finding with the fix commit and verification
result. Resolve only Codex threads whose findings are fixed and verified.
Leave human review threads and unfixed Codex threads alone. If push, reply, or
resolution fails, report the unfinished action rather than claiming it happened.

Request another Codex review of the new head while requests remain. Never exceed
`max_reviews`. If fixes are pushed after the last allowed review, report that the
new head still needs review; it is not review-clean.

## Resume and finish

Keep the PR/ticket links, request count, request link, requested head, deadline,
and remaining findings in the current task. On resume, re-read the current head
and existing responses. Keep the count and deadline; do not restart them or post
a duplicate review request. If a previous post's outcome is uncertain, check
whether it exists before retrying. If that evidence is unavailable, ask instead
of guessing.

Finish with a concise summary of fixed findings and commits, check results,
remaining findings, and any pending or stale Codex review. State why the loop
stopped: current-head review complete, request limit, timeout, blocker, or human
decision. Report Codex review completion separately from overall PR readiness.
Never merge.
