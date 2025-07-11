---
title: "Node Types & Templates"
date: "2025-01-01"
author: ""
published: true
---

## Configuring Node Types

Node types are the building blocks of your discourse graph. Each node type represents a different kind of content or concept in your notes.

### Adding a Node Type

1. Under "Node Types," click "Add Node Type"
2. Enter a name for your node type (e.g., "Claim", "Evidence", "Question")
3. Add the format for your node type. eg a claim node will have page title "CLM - {content}"
4. **Template (Optional)**: Select a template from the dropdown to automatically apply template content when creating nodes of this type
   - Templates are sourced from Obsidian's core Templates plugin
   - Ensure you have the Templates plugin enabled and configured with a template folder
   - The dropdown will show all available template files from your configured template folder

      ![add node types with template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FHMg_Tq6qiR.png?alt=media&token=69828bfc-c939-41b0-abd4-2cc8931c5a38)
   - Click "Save Changes"

## Working with Templates

Templates allow you to automatically add predefined content when creating new nodes. They're especially useful for maintaining consistent structure across similar types of notes.

### Setting Up Templates

1. Create a new folder for templates
![new folder](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FyTtJ1a0iI2.png?alt=media&token=b5d09b10-f170-47cd-a239-ee5f7acd89dc)

2. Configure the template folder location in settings
![template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FhzZg_GJXY9.png?alt=media&token=508c8d19-1f13-4fb3-adf1-898dcf694f08)

3. Create template files
![create template file](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FtTr9vOnXnX.png?alt=media&token=dda1fe25-3ccf-42b4-8f3c-1cd29f82c3f7)

## Template Requirements

- Templates must be stored in your designated template folder
- The Templates core plugin must be enabled
- Template files should use Markdown format
- Templates can include any valid Markdown content

## Next Steps

- [Configure relationship types](./relationship-types)
- [Learn about creating nodes](./creating-discourse-nodes)
- [Explore advanced template usage](./using-templates) 