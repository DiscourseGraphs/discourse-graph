## Reviewer brief

<!-- Optional. Remove this section when it adds no value.
Include only the fields that help the reviewer:
- Result: The final behavior or outcome.
- Review focus: A decision, risk, or part of the diff that needs careful review.
- Risk or follow-up: Unresolved, unverified, or deferred work that affects approval.
Required above 400 changed lines: explain why the PR cannot reasonably be split,
identify the main review entry points, and describe the testing path.
-->

## Verification

<!-- Required. Record checks and results, including repository validation and applicable
build, lint, and manual testing. Use `Not run` with a reason for missing evidence,
or `Not applicable` with a reason. Keep command output out of the PR body. -->

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
- Outstanding findings:
- Unverified requirements:

<!-- Cite the applicable rule and evidence for each finding. Use `None` only when
checked. Record documented exceptions with links. Checking the box means the review
ran, not that every requirement passed. -->

## Local delegated full review

- [ ] Ran a comprehensive review of the entire final diff in a subagent with a fresh context. Use `$dg-delegated-full-review` when no other full-review workflow is available.
