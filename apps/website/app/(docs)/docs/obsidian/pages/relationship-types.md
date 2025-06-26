---
title: "Relationship Types"
date: "2025-01-01"
author: ""
published: true
---

## Understanding Relationship Types

Relationship types define how different nodes in your discourse graph can connect to each other. Each relationship type has:
- A primary label (e.g., "supports")
- A complement label (e.g., "is supported by")
- Rules about which node types can be connected

## Adding Relationship Types

1. Open Obsidian Settings
2. Navigate to the "Discourse Graphs" settings tab
3. Under "Relation Types," click "Add Relationship Type"
4. Configure the relationship:
   - Enter the primary label (e.g., "supports", "contradicts")
   - Enter the complement label (e.g., "is supported by", "is contradicted by")
   ![add relation type](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2Fjk367dcO_K.png?alt=media&token=22d74e9f-882c-434b-8b50-afd7a754fb2b)
5. Click "Save Changes"

## Configuring Valid Relationships

After creating relationship types, you need to define which node types can be connected by each relationship.

1. Open the Discourse Relations tab in settings
![discourse relation](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FNgm7Ha4Ul5.png?alt=media&token=a933bd3a-d9a6-42c1-9c6e-d779d41c7ebf)

2. Choose the components:
   - Source Node Type (e.g., Claim)
   - Relationship Type (e.g., supports)
   - Target Node Type (e.g., Question)
![choose relation](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FlflJBkfdaK.png?alt=media&token=5de9617c-6099-46e8-931f-feafc604cabb)

3. Review and confirm the configuration
![final relations](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FycPW-N-rY8.png?alt=media&token=54867be2-9030-4c6c-82d2-b96069e52d81)

## Example Relationships

Here are some common relationship types:
- Claim → supports → Question
- Evidence → supports → Claim
- Evidence → contradicts → Claim
- Source → informs → Question

## Next Steps

- [Create your first relationship](./creating-discourse-relationships)
- [Learn about the Discourse Context](./using-discourse-context)
- [Explore your graph](./exploring-discourse-graph) 