<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/54299890-47b2-44f8-beed-738a49eb53cc">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/099e3134-b6b5-47d9-997f-df34426e4cde">
  <img alt="Shows project promo image in light and dark mode">
</picture>

The Discourse Graph extension enables Roam users to seamlessly add additional semantic structure to their notes, including specified page types and link types that model scientific discourse, to enable more complex and structured knowledge synthesis work, such as a complex interdisciplinary literature review, and enhanced collaboration with others on this work.

For more information about Discourse Graphs, check out our website at [https://discoursegraphs.com](https://discoursegraphs.com)

## Table of Contents

**WIP**

- [Discourse Graphs](https://discoursegraphs.com/docs/roam) documentation
- [Query Builder](https://github.com/DiscourseGraphs/discourse-graph/blob/main/apps/roam/docs/query-builder.md) documentation

## Nomenclature

There are some important terms to know and have exact definitions on since they will be used throughout the docs.

- `Page` - A Page is anything in Roam that was created with `[[brackets]]`, `#hashtag`, `#[[hashtag with brackets]]`, or `Attribute::`. Clicking on these links in your graph takes you to its designated page, each with its own unique title, and they have no parent.
- `Block` - A bullet or line of text in Roam. While you can also go to pages that have a zoomed in block view, their content is not unique, and they always have one parent.
- `Node` - A superset of `Block`s and `Page`s.

## Analytics & Privacy

The Discourse Graphs extension uses PostHog analytics to help us understand how the extension is being used and improve it. We take privacy seriously and:

- Do not track encrypted graphs
- Do not track offline graphs
- Do not automatically capture page views or clicks
- Only track specific user actions like creating Discourse Graph nodes, running queries, and using the canvas

This minimal tracking helps us understand how researchers use the extension so we can make it better while respecting your privacy.
