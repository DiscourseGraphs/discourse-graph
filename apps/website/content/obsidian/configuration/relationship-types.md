---
title: "Relationship types"
date: "2025-01-01"
author: ""
published: true
---

## Understanding relationship types

Relationship types define how different nodes in your discourse graph can connect to each other. Each relationship type has:

- A primary label (e.g., "supports")
- A complement label (e.g., "is supported by")
- Rules about which node types can be connected

## Adding relationship types

1. Open Obsidian **Settings**, then the **Discourse Graphs** tab
2. Open the **Relation types** tab
   ![Relation types settings](/docs/obsidian/relation-types-settings.png)
3. Click **Add relation type**
4. In the new row:
   - Enter the label (for example, "supports")
   - Enter the complement (for example, "is supported by")
   - Pick a color (Black by default)
     ![Add relation type](/docs/obsidian/relation-types-add.png)

Changes save when you leave a field, as long as both the label and the complement are filled in and neither matches an existing relation type.

## Configuring valid relationships

After creating relationship types, you need to define which node types can be connected by each relationship.

You can also do both from the canvas while connecting two nodes. See [Add a relation type from the canvas](/docs/obsidian/core-features/canvas#add-a-relation-type-from-the-canvas).

1. Open the **Discourse relations** tab in settings
   ![Discourse relations settings](/docs/obsidian/discourse-relations-settings.png)
2. Click **Add relation**
3. In the new row, choose:
   - **Source Node Type** (for example, Claim)
   - **Relation Type** (for example, supports / is supported by)
   - **Target Node Type** (for example, Question)
     ![Add discourse relation](/docs/obsidian/discourse-relations-add.png)

The relation saves automatically once all three are set.

## Example relationships

Here are some common relationship types:

- Claim → supports → Question
- Evidence → supports → Claim
- Evidence → contradicts → Claim
- Source → informs → Question

## Related

- [Create your first relationship](/docs/obsidian/core-features/creating-discourse-relationships)
- [Learn about the discourse context](/docs/obsidian/core-features/discourse-context)
- [Explore your graph](/docs/obsidian/core-features/canvas)
