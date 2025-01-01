---
title: "Creating Discourse Relationships"
date: "2025-01-01"
author: ""
published: true
---

**You can create formal discourse relations between nodes by writing and outlining!**

The extension has an in-built [grammar](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/fundamentals/the-discourse-graph-extension-grammar) that enables it to recognize when certain patterns of writing and outlining are meant to express particular discourse relations (e.g., support, oppose, inform) between discourse nodes. When it recognizes these patterns, it "writes" them to a formal discourse graph data structure, that you can then use to explore or query your discourse graph.

## Basic "stock" patterns

The extension ships with the ability to recognize three such writing/outlining patterns. Give them a try!

### Question informed by Evidence

Go into a question page.

Create a block, and reference an evidence page.

Like this:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FH9gwHdsH7oYG8Qm2fe93%252FCleanShot%25202022-03-26%2520at%252021.57.06.png%3Falt%3Dmedia%26token%3D474cf30c-7948-4edc-900d-31538d8b4a14&width=768&dpr=4&quality=100&sign=f79abb8f&sv=2)

The system now formally recognizes that this piece of evidence **informs** the question (and equivalently, the question is **informed by** that evidence)!

You can verify this by checking the [discourse context](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/exploring-your-discourse-graph/discourse-context) of the question or the evidence page.

Or by running a [query](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/querying-your-discourse-graph) for evidence that informs that question.

### Claim supported by Evidence

Create a block anywhere, and reference a claim page. We'll call this the claim block.

Indent a block underneath the claim block. And reference the page `[[SupportedBy]]`. We'll call this the connecting block.

Indent a block underneath the connecting block. And reference an evidence page.

Like this:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FnoU9ZujGFPHYMuuaNTJt%252FCleanShot%25202022-03-26%2520at%252021.57.25.png%3Falt%3Dmedia%26token%3Db25c32a8-5371-4b6b-b283-17c5247db532&width=768&dpr=4&quality=100&sign=24d67ba2&sv=2)

The system now formally recognizes that this piece of evidence **supports** that claim (and equivalently, the claim is **supported by** that evidence)!

You can verify this by checking the [discourse context](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/exploring-your-discourse-graph/discourse-context) of the claim or the evidence page.

Or by running a [query](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/querying-your-discourse-graph) for evidence that supports that claim.

### Claim opposed by Evidence

Create a block anywhere, and reference a claim page. We'll call this the claim block.

Indent a block underneath the claim block. And reference the page `[[OpposedBy]]`. We'll call this the connecting block.

Indent a block underneath the connecting block. And reference an evidence page.

Like this:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252Fl31B28XNlmjDwPamERlE%252FCleanShot%25202022-03-26%2520at%252021.57.49.png%3Falt%3Dmedia%26token%3De7737f12-27b3-4ff8-aa67-93b682f88f05&width=768&dpr=4&quality=100&sign=c0d24cae&sv=2)

The system now formally recognizes that this piece of evidence **opposes** that claim (and equivalently, the claim is **opposed by** that evidence)!

You can verify this by checking the [discourse context](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/exploring-your-discourse-graph/discourse-context) of the claim or the evidence page.

Or by running a [query](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/querying-your-discourse-graph) for evidence that supports that claim

## Digging deeper

Want to recognize other patterns that aren't listed here? Or don't like these? You can [change them](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/extending-and-personalizing-your-discourse-graph)! But you might first want to [understand how the grammar works](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/fundamentals/the-discourse-graph-extension-grammar).
