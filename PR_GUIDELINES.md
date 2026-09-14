# PR guidelines

This is the repository source for the DevOps PR process. Code standards live in [STYLE_GUIDE.md](STYLE_GUIDE.md); agent instructions live in [AGENTS.md](AGENTS.md). Production changes, releases, and work intake remain in DevOps.

## Scope and structure

- Use one PR per Linear ticket. You may batch very minor, unrelated changes of a few lines when they are low risk.
- Scope the ticket to one specific problem. If additional problems need attention, pause that additional work and check with the team or lead before implementing it.
- Use separate PRs for unrelated refactors, feature additions, dependency updates, and lint or style fixes. Keep scope to a single package or app when possible.
- For features spanning packages, make foundational changes such as types and shared utilities first, then use separate PRs for usage and integration.

## Size and review guidance

About 200 added plus removed lines is a useful target. Up to 400 lines is acceptable when the change is scoped and self-contained. Ideally, touch fewer than five files; repetitive mechanical changes can justify more. These are review guidelines, not automatic rejection thresholds.

Above 400 changed lines, explain why the PR cannot reasonably be split. Include the main review entry points and intended testing path in Reviewer brief. Keep this concise rather than adding a file-by-file summary.

## Branches and PR metadata

- Use Linear's generated branch name through Copy Branch Name.
- For Linear-backed work, use `ENG-#### Exact Linear ticket title` as the PR title. This is the repository convention in place of the alternative title formats previously listed in DevOps.
- Start with [.github/pull_request_template.md](.github/pull_request_template.md). Treat the ticket as the source of truth rather than restating it. Follow the PR body guidance in [AGENTS.md](AGENTS.md#pull-request-bodies).

## Before requesting review

- Run `pnpm install --frozen-lockfile`, then `pnpm ci:validate` from the repository root before opening a PR or declaring it ready. Resolve failures before requesting review. A draft must disclose unresolved validation blockers.
- Check applicable build and lint commands. Manually exercise changed behavior end-to-end, including relevant edge cases and alternative flows. Record results in Verification; explain checks that were not run or do not apply.
- Read the complete final diff and review it against [STYLE_GUIDE.md](STYLE_GUIDE.md), including added and modified comments. Use inline PR comments for review-specific explanations and durable code comments for constraints future changes must preserve.
- Run `$scope-check` against the ENG ticket and final diff. Paste its Scope check section into the PR body. If `Done When` is missing, leave the checkbox unchecked and state that explicitly.
- Run `$dg-pr-adherence-check` against the final diff and PR metadata. Record findings and missing evidence in Standards check. An executed check does not mean all requirements passed.
- Complete the Local delegated full review required by the template, using `$dg-delegated-full-review` when no other full-review workflow is available.
- Include a Loom video for every PR, including backend, refactor, and infrastructure changes. Keep it under 2–3 minutes, show before/after for bug fixes, and narrate key decisions. Put the link in Loom video.
- After self-review, request `@coderabbitai full review` on the PR and address actionable comments before requesting human review. Agents need explicit authorization to post review requests or comments.
- Assign a reviewer when ready. Do not mark a draft ready while required evidence or reviews remain incomplete.

## GitHub checks and merge

After opening or updating an authorized PR, wait for its required GitHub checks and report their final status. Do not represent pending, unavailable, or skipped checks as passed.

Delete the PR branch after a successful merge. Creating a draft does not authorize merging or deleting branches.
