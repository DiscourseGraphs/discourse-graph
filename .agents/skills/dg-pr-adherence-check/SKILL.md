---
name: dg-pr-adherence-check
description: Review a PR or local diff for adherence to Discourse Graphs code standards and PR requirements, report concerns to the author, and return a Standards check checkbox. Use before handoff or requesting review, alongside scope-check.
---

# PR adherence check

Review the final change against the repository's current rules. Remain read-only unless the user authorizes fixes or PR updates. Do not post comments, request reviews, or change ticket status as part of this check.

## Resolve the evidence

1. Use the supplied PR or resolve the current branch's PR. Read its title, base and head commits, complete diff, body, checks, and review state. For local work, compare with the merge base of the intended PR base and include staged, unstaged, and relevant untracked files. Identify unavailable metadata and explicitly exclude unrelated local work.
2. Read root `AGENTS.md`, `STYLE_GUIDE.md`, `PR_GUIDELINES.md`, and `.github/pull_request_template.md`. Read nested `AGENTS.md` files applicable to every changed path. Resolve these from the target repository, not the skill's installation directory. If reviewing changes to the rules themselves, also inspect the base versions so removing a requirement cannot silently erase a finding.
3. Resolve the Linear ticket from an explicit identifier, then the PR or branch. Use the repository's `$scope-check` skill for the `Done When` boundary and its separate Scope check output. Missing ticket access or acceptance criteria blocks the scope conclusion, not independent standards checks.
4. Use command results and manual testing evidence tied to the reviewed revision. A checked box or successful unrelated CI job is not proof of all validation. Record the reviewed head and any local changes so stale evidence is identifiable.

## Evaluate adherence

- Inspect the complete diff and enough surrounding code to assess applicable TypeScript, UI, organization, comments, documentation, hygiene, and testing rules. Focus findings on introduced or modified code, not unrelated existing debt.
- Check title and branch conventions, ticket linkage, PR body requirements, size guidance, split justification, review entry points, testing evidence, Loom, and review/check status against `PR_GUIDELINES.md`.
- Distinguish mandatory rules from preferences. Words such as “prefer” and “ideally,” the 200-line target, and the five-file guideline need judgment. Above 400 changed lines, excluding tests, check for the required explanation and review guide rather than rejecting the size alone.
- Explain concerns briefly to the PR author so they can address them; formal rule citations and evidence for each finding are not required. Do not invent exceptions, team approval, testing outcomes, or video contents. If a required document is unavailable or rules conflict without a clear applicable resolution, report the gap instead of guessing.
- Respect workflow timing: missing Loom or review evidence can be reported as outstanding before requesting review while a draft is being prepared. Do not call future post-merge steps violations on an open PR.
- Keep scope expansions in Scope check. Verification is optional. Standards check only records whether the check ran.

## Return the result

Return a copy-ready section:

```markdown
## Standards check

- [x] Ran `$dg-pr-adherence-check` against the final diff and PR metadata.
```

The checkbox means the review ran, not that all requirements passed. If the diff cannot be resolved or the review could not run, leave it unchecked and tell the author what blocked it. Separately make any outstanding findings or unverified requirements known to the PR author so they can address them; do not require these details in the PR body. Rerun affected checks after changes to code, rules, or PR metadata.
