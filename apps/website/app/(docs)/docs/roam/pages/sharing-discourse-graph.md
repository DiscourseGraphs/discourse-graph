---
title: "Sharing Discourse Graph"
date: "2025-01-01"
author: ""
published: true
---

You can export your discourse graph as a whole, or from queries of your graph, to archive your most important notes, or share them with others.

The extension exports to 1) markdown, 2) csv (neo4j-compatible [labeled property graph](https://neo4j.com/blog/rdf-triple-store-vs-labeled-property-graph-difference/)), and 3) `json`

Demo:

## Markdown export options

Since markdown has different flavors, and different tools you might want to export/archive your notes to handle links differently (e.g., wikilinks vs. markdown links) and different operating systems have different filename limitations, we have a range of options for customizing the markdown export. These can be found on the `Export` tab of the discourse graph configuration in `roam/js/discourse-graph`.

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FwN1ubNMnOFHwHMP9Oskb%252FCleanShot%25202022-08-10%2520at%252010.03.33%25402x.png%3Falt%3Dmedia%26token%3Df77df57e-519f-498e-9294-b478fb8990bc&width=768&dpr=4&quality=100&sign=5978d0a8&sv=2)

Here is a brief explanation of each option:

- `Max Filename Length` sets the maximum length of the filenames; this is important if you have page names that are quite long and may run afoul of, say, Windows' filename length limit of 250-260 characters.
- `Remove Special Characters` removes all "special characters" that may lead to trouble for filenames in different operating systems, such as `?` (not allowed on Windows) or `/` (denotes file/folder boundaries).
- `Simplified Filename` strips away all "template" characters (i.e., everything except the `{content}` in the node format: for example, if you define a Claim node as `[[CLM]] - {content}`, and have a Claim node `[[[[CLM]] - people are lazy]]`, the exported filename will be `people are lazy`
- `Frontmatter` specifies what properties to add to the YAML.

  - By default, the properties are:

    - `title: {text}`
    - `author: {author}`
    - `date: {date}`

  - You can add properties as key-value pairs in the same format:

    - ![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FOnl6Zd8Ej0Z3DLnwI66H%252FCleanShot%25202022-08-10%2520at%252010.11.22.gif%3Falt%3Dmedia%26token%3D313669a2-77cc-4c57-b5aa-5b202c237d90&width=300&dpr=4&quality=100&sign=4cf91&sv=2)

- `Resolve Block References` and `Resolve Block Embeds` control whether you want to resolve block references/embeds in your export. You can keep this turned off if you are unsure of the privacy implications of references/embeds.
- Link Type controls whether inline page references are wikilinks (`[[like this]]`) or alias (`[like this](pageName.md)`)

Here is an example of a discourse graph exported to Obsidian-compatible markdown: [https://publish.obsidian.md/joelchan-notes](https://publish.obsidian.md/joelchan-notes)
