---
title: "Sharing Your Discourse Graph"
date: "2025-01-01"
author: ""
published: true
---

You can export your discourse graph as a whole, or from queries of your graph, to archive your most important notes, or share them with others.

The extension exports to a number of formats, select an export option to see the options available.

![](/docs/roam/command-palette-export.png)

Demo:

[https://www.loom.com/share/ca222cb93efb4ed890b4c9e91f05db52](https://www.loom.com/share/ca222cb93efb4ed890b4c9e91f05db52)

## Export Options

We have a range of options for customizing the markdown export. These can be found on the `Export` tab of the discourse graph configuration.

![](/docs/roam/settings-export.png)

Here is a brief explanation of each option:

`Max Filename Length`

- sets the maximum length of the filenames; this is important if you have page names that are quite long and may run afoul of, say, Windows' filename length limit of 250-260 characters.

`Remove Special Characters`

- removes all "special characters" that may lead to trouble for filenames in different operating systems, such as `?` (not allowed on Windows) or `/` (denotes file/folder boundaries).

`Simplified Filename`

- strips away all "template" characters (i.e., everything except the `{content}` in the node format: for example, if you define a Claim node as `[[CLM]] - {content}`, and have a Claim node `[[[[CLM]] - people are lazy]]`, the exported filename will be `people are lazy`

`Frontmatter`

- specifies what properties to add to the YAML.

- By default, the properties are:

  - `title: {text}`
  - `author: {author}`
  - `date: {date}`

- You can add properties as key-value pairs in the same format:

  - ![](/docs/roam/settings-export-frontmatter.png)

`Resolve Block References` and `Resolve Block Embeds`

- control whether you want to resolve block references/embeds in your export. You can keep this turned off if you are unsure of the privacy implications of references/embeds.

`Link Type`

- controls whether inline page references are wikilinks (`[[like this]]`) or alias (`[like this](pageName.md)`)

## Example

Here is an example of a discourse graph exported to Obsidian-compatible markdown: [https://publish.obsidian.md/joelchan-notes](https://publish.obsidian.md/joelchan-notes)
