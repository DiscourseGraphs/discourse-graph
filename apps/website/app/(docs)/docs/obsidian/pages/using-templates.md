---
title: "Using Templates"
date: "2025-01-01"
author: ""
published: true
---

## Understanding Templates

Templates in Discourse Graphs help you maintain consistent structure across your nodes. They can include predefined content, metadata, and formatting that's automatically applied when creating new nodes.

## Setting Up Templates

### Create Template Directory

1. Create a new folder for your templates
![new folder](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FyTtJ1a0iI2.png?alt=media&token=b5d09b10-f170-47cd-a239-ee5f7acd89dc)

2. Configure the template folder in Obsidian settings
![template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FhzZg_GJXY9.png?alt=media&token=508c8d19-1f13-4fb3-adf1-898dcf694f08)

### Create Template Files

1. Create a new file in your template folder
2. Add your template content
![create template file](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FtTr9vOnXnX.png?alt=media&token=dda1fe25-3ccf-42b4-8f3c-1cd29f82c3f7)

## Template Structure

### Basic Template Components

```markdown
---
type: claim
created: {{date}}
---

# {{title}}

## Summary
[Brief summary of the claim]

## Evidence
- [ ] Evidence point 1
- [ ] Evidence point 2

## Related
- [ ] Link to supporting evidence
- [ ] Link to counter-arguments
```

### Advanced Template Features

1. **Dynamic Fields**
   - `{{date}}`: Current date
   - `{{title}}`: Node title
   - `{{time}}`: Current time

2. **Sections for Different Node Types**
   - Claims: Evidence and counter-arguments
   - Questions: Context and potential answers
   - Evidence: Sources and methodology

## Using Templates with Node Types

1. Open Obsidian Settings
2. Navigate to Discourse Graphs settings
3. Select a node type to edit
4. Choose a template from the dropdown
![add node types](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FYRZ6ocI_d-.png?alt=media&token=c623bec7-02bd-42b4-a994-cd1c40a54d82)

## Template Best Practices

1. **Consistency**
   - Use consistent headings across templates
   - Maintain similar structure for similar node types
   - Include standard metadata fields

2. **Modularity**
   - Create base templates for common elements
   - Use specific templates for specialized nodes
   - Keep templates focused and concise

3. **Maintenance**
   - Regularly review and update templates
   - Document template purposes
   - Version control your templates

## Example Templates

### Claim Template
```markdown
# {{title}}
Type: Claim
Created: {{date}}

## Statement
[Enter claim here]

## Support
- Evidence:
- Reasoning:

## Counter-Arguments
- [ ] Potential counter-points
```

### Evidence Template
```markdown
# {{title}}
Type: Evidence
Created: {{date}}

## Source
- Author:
- Date:
- Link:

## Key Findings
- Finding 1
- Finding 2

## Methodology
- [ ] Describe research method
```

## Next Steps

- [Configure node types](./node-types-templates)
- [Create your first node](./creating-discourse-nodes)
- [Learn about relationships](./relationship-types) 