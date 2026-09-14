---
name: dg-assess-security-advisories
description: Assess Discourse Graphs Dependabot alerts for actual exposure, produce evidence-backed reports, and carry out approved dismissal or remediation decisions. Use for individual advisories or review batches.
---

# Assess security advisories

Explain whether an advisory affects our system, what an attacker would need, and what we should do. Package severity and installation alone do not establish exposure.

Use `$dg-engineering-writing-style` for explanations and `$dg-create-engineering-ticket` when a ticket is requested. Preserve the user's scope: a request for a count, ticket, explanation, or dry run does not authorize a full assessment or GitHub mutations.

## Assess

1. For a batch, snapshot authenticated GitHub alerts and record the selection rule. Exclude prior reviewed alert numbers when the user asks for the next batch. Preserve duplicate advisories across manifests as separate entries.
2. Pin evidence to the reviewed main commit. Follow the vulnerable function from its workspace dependency path to actual callers, inputs, and outputs. Read [assessment.md](references/assessment.md) for the evidence checklist and parent-package investigation.
3. Classify the result as unused vulnerable code, exposure proposed for risk acceptance, routine remediation, product remediation, or unresolved. State confidence and what has not been tested. Do not convert uncertainty into a dismissal.
4. Produce the requested explanation or report. For batches, use [templates.md](references/templates.md) and the [HTML template](assets/report.html). Save artifacts under the repository's `local/` directory, not an operating-system `/local` directory.

## Decide and act

Present a concrete recommendation before requesting a decision. Honor approval already given for the same action and batch; do not ask twice. Do not infer approval for a different alert from a previous dismissal.

Before an approved dismissal, remediation PR, or closure, read [decisions.md](references/decisions.md). It covers rechecking evidence, choosing the dismissal reason, recording comments, verifying results, and closing the assessment without misrepresenting deferred risks as fixed.

The default is an assessment, not an automatic upgrade or dismissal. Michael has accepted some tooling risk, but that historical decision is not blanket approval. A dependency override also has maintenance cost; explain why it is needed and when it can be removed.

## Examples and validation

Read [cases.md](references/cases.md) when an example helps explain a decision or when validating changes to this skill. Its three historical cases cover an unused vulnerable function, accepted tooling risk, and shared content reaching a parser. They are fixtures, not current security determinations.

A dry run produces local recommendations only. It must not post comments, dismiss alerts, change dependencies, or open tickets/PRs. Validate the reasoning against the evidence, not by matching exact wording.
