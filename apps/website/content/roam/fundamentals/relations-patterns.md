---
title: "Relations and patterns"
date: "2025-01-01"
author: ""
published: true
---

Pattern-based relations are a **legacy workflow**. New graphs use [**stored relations**](/docs/roam/fundamentals/stored-relations) by default. If you're still using patterns or you're not sure which system your graph is on, see [**Migration to stored relations**](/docs/roam/fundamentals/migration-to-stored-relations).

The legacy pattern workflow recognizes a few common writing and outlining structures and converts them into discourse relations.

- [Informed](#question-informed-by-evidence)
- [Supported](#claim-supported-by-evidence)
- [Opposed](#claim-opposed-by-evidence)

## Question Informed by Evidence

- Go into a Question page.
- Create a block and reference an evidence page.

Like this:

![](/docs/roam/relation-informs.png)

The system recognizes that this piece of evidence **informs** the question.

## Claim Supported by Evidence

Create a block anywhere and reference a claim page. We'll call this the claim block.

Indent a block underneath the claim block and reference the page `[[SupportedBy]]`. We'll call this the connecting block.

Indent a block underneath the connecting block and reference an evidence page.

Like this:

![](/docs/roam/relation-supports.png)

The system recognizes that this piece of evidence **supports** that claim.

## Claim Opposed by Evidence

Create a block anywhere and reference a claim page. We'll call this the claim block.

Indent a block underneath the claim block and reference the page `[[OpposedBy]]`. We'll call this the connecting block.

Indent a block underneath the connecting block and reference an evidence page.

Like this:

![](/docs/roam/relation-opposes.png)

The system recognizes that this piece of evidence **opposes** that claim.

