---
title: "Migration to stored relations"
date: "2025-01-01"
author: ""
published: true
---

## Migrate relations to stored relations

### Summary

Stored relations make relations load faster and more reliably. To start using them, your graph needs a one-time migration that copies your existing relations into the new format.

This guide covers the migration flow from **Personal Settings**. If you’re new to stored relations, start with the [stored relations overview](./stored-relations).

## Turn on stored relations

1. Open **Personal Settings**
2. Go to the **Home** panel
3. Find **Enable stored relations**
4. Turn the toggle **On**

When you turn this on, you’ll be shown a migration step for your graph.

## Migrate your existing relations

After enabling the toggle, click:

**Migrate all relations**

What to expect:

- It may take a few minutes
- Roam may feel frozen while it runs (this is expected)
- You **can** work in **another Roam window** during the migration
- When it finishes, you can continue working normally

## When should I run migration again?

You only need to run migration again if:

- Relations were created while stored relations were turned off
- Your team is transitioning gradually and some people are still using the older relation method

## Multi-user graphs

Migration runs **per graph**, but the stored relations toggle is **per user**. During rollout, it’s possible for teammates to be in different modes.

If some users are still using the older relation method, running migration again later helps ensure you see the most up-to-date relations.

### What each user sees

#### If you do NOT opt in

- You can keep using **patterns** to create relations
- The overlay will search **only pattern-based** relations
- You **will not** see data-based relations

#### If you DO opt in

- You will see **only data-based** relations
- You **will not** see pattern-based relations

### Re-running migration (multi-user / mixed mode)

You can run migration **multiple times**.

This matters if:

- Some users are still creating **pattern-based** relations
- Other users have opted into **data-based** relations

In that case, opt-in users must re-run migration to “catch up,” otherwise:

- They won’t see new pattern-based relations created since the last migration

#### Important edge case

If you:

1. Delete a **data-based** relation that originally came from a pattern, and then
2. Re-run migration

… it will be **re-created** from the still-existing pattern.

### For the technically inclined

Data-based relations are stored in:

- `roam/js/discourse-graph/relations`

Each relation is a **block**, with relation data stored in the block’s **hidden properties**.
