## Reviewer brief

<!-- Optional. Remove this section when it adds no value.
Include only the fields that help the reviewer:
- Result: The final behavior or outcome.
- Review focus: A decision, risk, or part of the diff that needs careful review.
- Risk or follow-up: Unresolved, unverified, or deferred work that affects approval.
-->

## Verification

<!-- Optional checks and their results. Remove this section when it adds no value. -->

## Loom video

<!-- Include a short Loom video for every PR (any change—UI, backend, refactors, infra, etc.).
This helps reviewers understand intent quickly and catches issues earlier
- Keep it under 2–3 minutes
- Show before/after for bug fixes
- Narrate key design or dev decisions
- Paste the Loom link in the PR body
-->

## Scope check

- [ ] Ran `$scope-check` against the ENG ticket and final diff.
- Scope beyond `Done When`:

<!-- Add either:
- `None` when the final diff stays within Done When.
- What changed, why it is required now, whether anyone was affected or consulted, and links to the use case, ticket, or decision.
-->

## Standards check

- [ ] Ran `$dg-pr-adherence-check` against the final diff and PR metadata.

<!-- Checking the box means the review ran, not that every requirement passed.
Make any outstanding findings or unverified requirements known to the PR author
so they can address them. -->

## Local delegated full review

- [ ] Ran a comprehensive review of the entire final diff in a subagent with a fresh context. Use `$dg-delegated-full-review` when no other full-review workflow is available.
