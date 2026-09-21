---
name: dg-create-engineering-ticket
description: Create concise Discourse Graphs Engineering tickets in Linear with the canonical template, correct readiness status, an active existing project, and existing labels. Use when the user asks to create or draft an Engineering ticket; do not use for Feedback tickets.
---

# DG Create Engineering Ticket

Create an Engineering ticket that another engineer can understand and implement without rediscovering its intent or scope.

Use `$dg-engineering-writing-style` when available. It is in the repository's `./.agents/skills` folder.

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

## Agent provenance and human review

Always use the Engineering team. This skill never creates or redirects to Feedback.

- Create every agent-created ticket in the existing `Draft` status with exactly one existing agent provenance label. The label records provenance and stays after approval.
- Select the label from the creating agent's known identity: `Created by Claude` for Claude, `Created by Codex` for Codex, or `Created by LLM` for any other agent or when its identity cannot be determined. Do not infer agent identity from the Linear account, ticket topic, or skill name. Do not use `Created by LLM` as a substitute when the correct agent-specific label is missing.
- `Draft` means human ticket review is pending, even though Linear currently classifies it as a started status; it does not authorize implementation.
- In `Notes`, record `Created with: dg-create-engineering-ticket` and any other creation skills actually used. Skill attribution is provenance, not evidence that the ticket meets the standards.
- Record `Human reviewer: <requesting human>` in `Notes`. The requesting human owns review unless they name another human. If their identity is unknown, resolve it before creation; never infer it from an API or bot account.
- The human reviewer checks intent against the source request, scope and exclusions, verifiable acceptance criteria, and the canonical template and engineering writing standards. Keep the ticket in `Draft` while changes are needed.
- Human approval moves the ticket to `Backlog` when the problem and fix are agreed and implementation needs no further product or solution decisions. Use `Triage` when implementation is likely within six months but decisions remain. Keep idea-stage Engineering requests in Engineering.
- The human's move from `Draft` to `Triage` or `Backlog` records sign-off. An agent may make that move only after explicit human approval of the completed ticket and destination. A request to create a ticket is not approval of its generated contents. Keep the provenance label and skill attribution.

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
- Missing or uncertain optional labels do not block creation. If `Draft` or the required provenance label is missing or ambiguous, return the prepared draft and report the configuration gap instead of creating an unmarked ticket or substituting a status.
- Set priority only when the user or context makes it clear and useful.
- Do not set a cycle or release. CI/CD handles releases.

## Create or draft

Draft without changing Linear when the user asks for a draft, review, or rewrite. Create the ticket without an additional confirmation when the user explicitly asks to create it.

Before creation, resolve the current Engineering statuses, selected project, and existing labels. Create the issue once with its title, completed description (including reviewer and skill attribution), `Draft` status, project, provenance and relevant labels, and justified priority. If the result is ambiguous, search for the issue before retrying so a transient failure does not create a duplicate.

Read the created issue back and verify its status, labels, reviewer, and attribution. Report any mismatch instead of claiming successful routing. Return the issue identifier, title, status, project, reviewer, and link, and say that human review is pending. Include the generated branch name when Linear returns one. Do not restate the full description unless the user asks.
