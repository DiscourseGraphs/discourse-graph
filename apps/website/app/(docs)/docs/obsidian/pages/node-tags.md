---
title: "Node tags"
date: "2025-10-15"
author: ""
published: true
---

## Overview

Node tags allow you to quickly create discourse nodes from tagged lines in your notes. When you assign a tag to a node type, any line containing that tag becomes a clickable element that can be converted into a discourse node.

This feature streamlines your workflow by letting you mark potential discourse nodes with tags as you write, then easily convert them to full discourse nodes later.

## Setting Up Node Tags

### Configuring Tags in Settings

1. Open the Discourse Graph settings
2. Navigate to the **Node Types** section
3. Select an existing node type or create a new one
4. In the **Node tag** field, enter a tag identifier

![image here]()

### Tag Naming Rules

Tags must follow these rules:
- **No spaces**: Tags cannot contain whitespace
- **Allowed characters**: Only letters (a-z, A-Z), numbers (0-9), and dashes (-)
- **No special characters**: Characters like #, @, /, \, etc. are not allowed
- **Case-sensitive**: Tags are case-sensitive in the editor

#### Tag Examples

**Valid tags:**
- `clm-candidate`
- `question-idea`
- `evidence2024`
- `my-argument`

**Invalid tags:**
- `clm candidate` (contains space)
- `#clm-candidate` (contains #)
- `clm/candidate` (contains /)

### Automatic Tag Suggestions

The plugin provides intelligent tag suggestions based on your node type's format pattern. For example:

- If your format is `CLM - {content}`, the placeholder will suggest `clm-candidate`
- If your format is `QUESTION - {content}`, the placeholder will suggest `question-candidate`
- If your node name is "Evidence", it will suggest `evi-candidate`

You can use these suggestions or create your own tag identifiers.

![image here]()

## Using Node Tags in Your Notes

### Adding Tags to Your Notes

Once you've configured a node tag for a node type, simply add the tag (prefixed with `#`) to any line in your notes:

```markdown
#clm-candidate This is my main argument about climate change
#question-candidate What are the implications of this study?
#evidence-candidate Study shows 40% reduction in emissions
```

### Visual Feedback

Tagged lines receive visual styling based on the node type's color:

- **Background color**: Derived from the node type's color setting
- **Text color**: Automatically adjusted for readability
- **Cursor change**: Tags display a pointer cursor on hover

![image here]()

### Creating Discourse Nodes from Tags

When you hover over a tagged line, a button appears above the tag:

1. **Hover** over the tag you want to convert
2. Wait for the **"Create [Node Type]"** button to appear
3. **Click** the button to open the node creation dialog

![image here]()

#### Node Creation Dialog

The dialog pre-fills with:
- **Node type**: The type associated with the tag
- **Title**: The line content (minus the tag and list markers)
- **Editable fields**: You can change the node type or modify the title before creating

The title is automatically cleaned:
- List item indicators (`- `, `* `, `1. `) are removed
- Invalid file characters (`\`, `/`, `:`) are removed
- Extra whitespace is normalized
- The tag itself (`#tagname`) is removed

#### After Creation

Once you create the discourse node:
- The entire line is **replaced** with a wiki-link to the new node
- The node file is created with your configured format
- Any template associated with the node type is applied
- You can immediately click the link to open the new node

**Before:**
```markdown
- #clm-candidate This is my main argument
```

**After:**
```markdown
[[CLM - This is my main argument]]
```

![image here]()

## Best Practices

### Workflow Tips

1. **Tag while writing**: Add node tags as you brainstorm or capture ideas
2. **Batch convert**: Convert multiple tagged lines to discourse nodes in a focused editing session
3. **Use descriptive tags**: Choose tag names that clearly indicate the node type (e.g., `arg-candidate` for Arguments)
4. **Consistent naming**: Use a consistent pattern across your node type tags (e.g., all ending in `-candidate`)

### Tag Organization

Consider organizing your tags by purpose:

- **Candidate tags**: For potential nodes you'll review later (`clm-candidate`, `question-candidate`)
- **Draft tags**: For nodes you're developing (`clm-draft`, `evidence-draft`)
- **Review tags**: For nodes that need refinement (`clm-review`, `support-review`)

### Combining with Other Features

Node tags work seamlessly with:

- **Templates**: Created nodes automatically use the configured template
- **Canvas**: Convert tagged lines, then add the nodes to your canvas
- **Node relationships**: After creating nodes, connect them with discourse relations
- **Colors**: Tag styling reflects your node type color scheme

## Troubleshooting

### Tag Not Appearing

If your tag isn't showing up with styling:

1. **Check tag format**: Ensure the tag in your note exactly matches the tag in settings
2. **Verify no spaces**: Tags with spaces won't work
3. **Check for typos**: Tags are case-sensitive
4. **Restart required**: Sometimes you may need to reload Obsidian after changing tag settings

### Cannot Create Node

If the "Create [Node Type]" button doesn't work:

1. **Check permissions**: Ensure the plugin has permission to create files
2. **Verify template**: If using templates, ensure the template file exists
3. **Check file name**: Ensure the generated file name doesn't conflict with existing files

### Tag Styling Not Updating

If tag colors aren't updating after changing node type colors:

1. Switch to a different note and back
2. The plugin processes tags when you navigate between notes
3. Colors update automatically when you change node type settings

## Technical Details

### Tag Detection

The plugin uses a DOM observer to detect tags in real-time:
- Monitors editor for new content
- Applies styling immediately when tags are typed
- Watches for class changes on tag elements
- Processes existing tags when switching notes

### Content Extraction

When creating a node from a tag:
- The entire line is analyzed
- List markers are stripped
- Invalid file characters are sanitized
- The tag itself is removed from the title
- The original line is replaced with a wiki-link

### Color Calculation

Tag colors are derived from your node type's color setting:
- Background uses a semi-transparent version of the node color
- Text color is calculated for optimal contrast
- Hover states are automatically generated
- Colors update when you change node type settings
