---
title: "Node Types & Templates"
date: "2025-01-01"
author: ""
published: true
---

## Configuring Node Types

Node types are the building blocks of your discourse graph. Each node type represents a different kind of content or concept in your notes.

### Adding a Node Type

1. Open Obsidian Settings
2. Navigate to the "Discourse Graphs" settings tab
3. Under "Node Types," click "Add Node Type"
4. Configure the node type:
   - Enter a name (e.g., "Claim", "Evidence", "Question")
   - Add the format (e.g., "CLM - {content}")
   - Optionally select a template

![add node types with template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FHMg_Tq6qiR.png?alt=media&token=69828bfc-c939-41b0-abd4-2cc8931c5a38)

## Working with Templates

Templates allow you to automatically add predefined content when creating new nodes. They're especially useful for maintaining consistent structure across similar types of notes.

### Setting Up Templates

1. Create a new folder for templates
![new folder](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FyTtJ1a0iI2.png?alt=media&token=b5d09b10-f170-47cd-a239-ee5f7acd89dc)

2. Configure the template folder location in settings
![template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FhzZg_GJXY9.png?alt=media&token=508c8d19-1f13-4fb3-adf1-898dcf694f08)

3. Create template files
![create template file](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FtTr9vOnXnX.png?alt=media&token=dda1fe25-3ccf-42b4-8f3c-1cd29f82c3f7)

### Assigning Templates to Node Types

1. In the node type settings, select a template from the dropdown
2. The template will be automatically applied when creating nodes of this type
![add node types](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FYRZ6ocI_d-.png?alt=media&token=c623bec7-02bd-42b4-a994-cd1c40a54d82)

## Template Requirements

- Templates must be stored in your designated template folder
- The Templates core plugin must be enabled
- Template files should use Markdown format
- Templates can include any valid Markdown content

## Next Steps

- [Configure relationship types](./relationship-types)
- [Learn about creating nodes](./creating-discourse-nodes)
- [Explore advanced template usage](./using-templates) 