---
title: "Extending & Personalizing Your Graph"
date: "2025-01-01"
author: ""
published: true
---

## Configure Node and Relationship Types

### Edit Node Types

1. Open Obsidian Settings
2. Navigate to the "Discourse Graphs" settings tab
3. Under "Node Types," click "Add Node Type"
4. Enter a name for your node type (e.g., "Claim", "Evidence", "Question")
5. Add the format for your node type. eg a claim node will have page title "CLM - {content}"

#### Templates (Optional)
You can select a template from the dropdown to automatically apply template content when creating nodes of this type.

![add node types with template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FHMg_Tq6qiR.png?alt=media&token=69828bfc-c939-41b0-abd4-2cc8931c5a38)

Templates are sourced from Obsidian's core Templates plugin. To use this feature:
1. Ensure you have the Templates plugin enabled and configured with a template folder
2. The dropdown will show all available template files from your configured template folder

To create a new template:
1. Create new folder to store templates
![new folder](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FyTtJ1a0iI2.png?alt=media&token=b5d09b10-f170-47cd-a239-ee5f7acd89dc)

2. Specify template folder location in plugin settings menu
![template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FhzZg_GJXY9.png?alt=media&token=508c8d19-1f13-4fb3-adf1-898dcf694f08)

3. Create new file in template folder (A) and add text to file (B)
![create template file](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FtTr9vOnXnX.png?alt=media&token=dda1fe25-3ccf-42b4-8f3c-1cd29f82c3f7)

4. Add node types and click "Save Changes"
![add node types](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FYRZ6ocI_d-.png?alt=media&token=c623bec7-02bd-42b4-a994-cd1c40a54d82)

### Edit Relation Types

1. Under "Relation Types," click "Add Relationship Type"
2. A relation type is a kind of relationship that can exist between any two node types
3. Enter a name for your relationship (e.g., "supports", "contradicts")
4. Enter the complement label (e.g., "is supported by", "is contradicted by")
![add relation type](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2Fjk367dcO_K.png?alt=media&token=22d74e9f-882c-434b-8b50-afd7a754fb2b)
5. Click "Save Changes"

### Define Possible Relations Between Nodes

1. Open the Discourse Relations tab in the Discourse Graph settings
![discourse relation](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FNgm7Ha4Ul5.png?alt=media&token=a933bd3a-d9a6-42c1-9c6e-d779d41c7ebf)

2. Choose Source Node Type, Relation Type, and Target Node Type
![choose relation](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FlflJBkfdaK.png?alt=media&token=5de9617c-6099-46e8-931f-feafc604cabb)

3. Once you see the source, relation, and target selected:
![final relations](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FycPW-N-rY8.png?alt=media&token=54867be2-9030-4c6c-82d2-b96069e52d81)
For example: this means that *Claim* nodes can support *Question* nodes

4. Click "Save changes"

## Next Steps

Now that you've configured your graph structure:
- [Create your first node](./creating-discourse-nodes)
- [Create relationships between nodes](./creating-discourse-relationships)
- [Learn about exploring your graph](./exploring-discourse-graph) 