---
title: "Relations and patterns"
date: "2025-01-01"
author: ""
published: true
---

## Deprecation notice

Pattern-based relations are being deprecated. Please plan to move to [**stored relations**](./stored-relations), which will be the recommended way to define and persist discourse relations. Migration guidance is available in [**Migration to stored relations**](./migration-to-stored-relations).

## Stock Patterns

The extension ships with the ability to recognize three such writing/outlining patterns. Give them a try!

- [Informed](#question-informed-by-evidence)
- [Supported](#claim-supported-by-evidence)
- [Opposed](#claim-opposed-by-evidence)

### Question Informed by Evidence

- Go into a Question page.

- Create a block, and reference an evidence page.

Like this:

![](/docs/roam/relation-informs.png)

The system now formally recognizes that this piece of evidence **informs** the question (and equivalently, the question is **informed by** that evidence)!

### Claim Supported by Evidence

Create a block anywhere, and reference a claim page. We'll call this the claim block.

Indent a block underneath the claim block. And reference the page `[[SupportedBy]]`. We'll call this the connecting block.

Indent a block underneath the connecting block. And reference an evidence page.

Like this:

![](/docs/roam/relation-supports.png)

The system now formally recognizes that this piece of evidence **supports** that claim (and equivalently, the claim is **supported by** that evidence)!

### Claim Opposed by Evidence

Create a block anywhere and reference a claim page. We'll call this the claim block.

Indent a block underneath the claim block. And reference the page `[[OpposedBy]]`. We'll call this the connecting block.

Indent a block underneath the connecting block. And reference an evidence page.

Like this:

![](/docs/roam/relation-opposes.png)

The system now formally recognizes that this piece of evidence **opposes** that claim (and equivalently, the claim is **opposed by** that evidence)!
