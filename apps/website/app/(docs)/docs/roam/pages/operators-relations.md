---
title: "Operators and Relations"
date: "2025-01-01"
author: ""
published: true
---

## Roam-native

### `references`

- **description**: a block references some page. NOTE: you'll need to then chain that with something like `has title` or `with text` to identify the page.
- **source**: a `block`
- **target**: a `page`
- example:

  - this block references \[\[some page\]\]

### `is in page`

- **description**: source is in some page. NOTE: you'll need to then chain that with something like `has title` or `with text` to identify the page.
- **source**: a `block`
- **target**: a `page`

### `has ancestor`

- **description**: a block has some ancestor (i.e., the block is in the indentation path of some target, whether directly or indirectly)
- **source**: a `block`
- **target**: a `block` or `page`

### `has child`

- **description**: a block or page has some direct child (directly indented underneath)
- **source**: a `block` or `page`
- **target**: a `block`

### `has descendant`

- **description**: a block has some descendant (i.e., the target block is in the indentation path of the source, whether directly or indirectly). NOTE: you'll need to then chain that with something like `has title` or `with text` to identify the block.
- **source**: a `block` or `page`
- **target**: a `block`

### `has title`

- **description**: source text exactly matches some text
- **source**: a `page`, `block`, or `discourse node`
- **target**: a `string` that specifies the target title to match

### `with text`

- **description**: node content contains some text
- **source:** a `page`, `block`, or `discourse node`
- **target**: a `string` that specifies the target text to find in the node content

### `has attribute`

- **description**: has a child block with some attribute
- **source**: a `page` or `discourse node`
- **target**: a `string` that specifies the target attribute to be matched

## Discourse-graph only

### `is a`

- **description**: exact match to user-defined `discourse nodes` only (ALTHOUGH the autocomplete will allow you to specify other stuff that don't make sense)
- **source**: a `page` (since all discourse nodes must be pages)
- **target**: a `discourse node` (defined in your grammar)

## Next

- [Relations Patterns](./relations-patterns)
