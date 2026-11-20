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

1. Open Obsidian Settings
2. Navigate to the "Discourse Graphs" settings tab
3. Under "Relation Types," click "Add Relationship Type"
4. Configure the relationship:
   - Enter the primary label (e.g., "supports", "contradicts")
   - Enter the complement label (e.g., "is supported by", "is contradicted by")
     ![add relation type](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2Fjk367dcO_K.png?alt=media&token=22d74e9f-882c-434b-8b50-afd7a754fb2b)
5. Click "Save Changes"

## Configuring valid relationships

After creating relationship types, you need to define which node types can be connected by each relationship. There are two ways to configure the relationships between two node types.

### From the canvas

While connecting two nodes on the canvas, you can add an existing relationship type or create a new one for those node types. See [Add a relation type from the canvas](/docs/obsidian/core-features/canvas#add-a-relation-type-from-the-canvas).

### From settings

1. Open Obsidian **Settings**, then the **Discourse Graphs** tab
2. Open the **Discourse relations** tab
   ![Discourse relations settings](/docs/obsidian/discourse-relations-settings.png)
3. Click **Add relation**
4. In the new row, choose:
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
- [Share your schema with collaborators](/docs/obsidian/advanced-features/schema-import-export)
