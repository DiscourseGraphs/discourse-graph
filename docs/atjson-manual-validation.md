# ATJSON manual validation checklist

Use this checklist after applying the `content_type` migration and building the apps from this branch.

## Obsidian publish/import

- Publish an Obsidian node with a title, Markdown body, wikilink, and image embed.
- Confirm the source space has `direct/text/plain`, `full/text/markdown`, and `full/application/vnd.discourse-graph.atjson+json; version=1` rows for the node.
- Confirm the ATJSON row stores the document under `Content.metadata.content` and `Content.text` is readable plain text, not serialized JSON.
- Import the node into another Obsidian vault and confirm the importer uses the Markdown body row.
- Confirm file references still resolve from the Markdown row and imported asset links are rewritten as before.

## Roam local-to-remote sync

- Sync a Roam discourse node with child blocks, a page ref, a block ref, a link, and an image.
- Confirm the source space keeps the existing text/plain row and adds `full/application/vnd.discourse-graph.atjson+json; version=1`.
- Confirm the Roam ATJSON body has block annotations with stable block IDs and parent IDs.
- Confirm embeddings are created only for text/plain rows.

## Native-only reads

- Confirm no production import path prefers ATJSON.
- Confirm Obsidian reads `direct/text/plain` for titles and `full/text/markdown` for bodies.
- Confirm adding ATJSON rows does not change current import output.
