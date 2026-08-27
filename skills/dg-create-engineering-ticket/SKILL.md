---
name: dg-create-engineering-ticket
description: Create concise Discourse Graphs Engineering tickets in Linear with the canonical template, correct readiness status, an active existing project, and existing labels. Use when the user asks to create or draft an Engineering ticket; do not use for Feedback tickets.
---

# DG Create Engineering Ticket

Create an Engineering ticket that another engineer can understand and implement without rediscovering its intent or scope.

Use `$dg-engineering-writing-style` when available. Until that namespace migration is complete, fall back to `$discourse-engineering-writing-style` when available.

## Canonical template

The canonical Linear template is [General Engineering Task](https://linear.app/discourse-graphs/new?template=6ca39698-3bce-449a-992e-059f0334e15b). Keep this link only as a reference in this skill. Never add it to a created ticket.

Use this exact template as the drafting checklist:

```markdown
## Problem

- What accepted user, developer, or project need does this address?
- Why does it need to be solved now?

## Solution

- What is the smallest change that solves the problem?

## Done When

- Describe how success is verified (behavioral or technical).
- Remember: Make only the smallest change needed to solve the problem.
- Remember: **Stay within the defined scope, or communicate any scope increase**

## Out of Scope

- (Optional) What adjacent cases, abstractions, or future work are explicitly not included?
- Link follow-up tickets where applicable

## Notes

- Additional Context, Blockers, dependencies, or follow-up actions.
```

Every bullet above is placeholder guidance. Replace or remove every placeholder before presenting a draft or creating a ticket. Keep all five headings, leaving `Out of Scope` or `Notes` empty when nothing useful applies. Use 1–3 short bullets per section unless the ticket is genuinely complex.

## Ticket readiness

Always use the Engineering team. This skill never creates or redirects to Feedback.

- Use `Backlog` when the problem is known, the fix is agreed upon, and another engineer can implement it without further product or solution decisions.
- Use `Triage` when implementation is likely within six months but the decision, scope, or solution is not fully settled.
- Keep an explicit Engineering ticket request in Engineering even when it is idea-stage.

## Project selection

Every ticket must use an existing project that is not completed, canceled, archived, or trashed. Resolve the project in this order:

1. Use the project explicitly named by the user.
2. Use a clearly relevant active project from the current work context.
3. For Roam work, use `Roam Discourse Graph plugin assorted tasks`.
4. For Obsidian work, use `Obsidian Discourse Graphs plugin assorted tasks`.
5. Otherwise, use `Engineering Ops assorted tasks`.

Confirm the selected project still exists, is active, and includes the Engineering team. Never create a project. If a user-specified project is missing, ambiguous, or inactive, ask the user for another project instead of silently substituting one.

## Labels and optional fields

- Inspect existing issue labels and apply every clearly relevant label.
- Never create a label or guess an uncertain label.
- Missing or uncertain labels do not block creation. After creation, tell the user when no label was applied or when label selection remained uncertain.
- Set priority only when the user or context makes it clear and useful.
- Do not set a cycle or release. CI/CD handles releases.

## Create or draft

Draft without changing Linear when the user asks for a draft, review, or rewrite. Create the ticket without an additional confirmation when the user explicitly asks to create it.

Before creation, resolve the current Engineering statuses, selected project, and existing labels. Create the issue once with its title, completed description, status, project, labels, and justified priority. If the result is ambiguous, search for the issue before retrying so a transient failure does not create a duplicate.

After creation, return the issue identifier, title, status, project, and link. Include the generated branch name when Linear returns one. Do not restate the full description unless the user asks.
