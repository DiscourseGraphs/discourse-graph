# ATJSON v1 follow-up ticket drafts

These are the follow-up issues to create after the v0 write-only storage test run is reviewed.

## Prefer ATJSON reads behind a feature gate

- Add a reader mode that can prefer ATJSON only when renderer parity tests pass.
- Keep fallback to native `full/text/markdown` and `direct/text/plain`.
- Include rollout metrics and an explicit rollback path.

## Render ATJSON to Obsidian imports

- Use `@repo/content-model` Obsidian rendering for imported files.
- Match current Markdown importer behavior for frontmatter, wikilinks, embeds, and file references.
- Switch production only after fixture parity covers representative Roam and Obsidian documents.

## Materialize ATJSON to Roam

- Add ATJSON-to-Roam page/block materialization.
- Preserve page refs, block refs, block parentage, links, images, code, and block view types.
- Keep the current Roam sync/write behavior unchanged until renderer parity is accepted.

## Wire website publishing to the HTML renderer

- Use the shared `DgDocument` HTML renderer for published node views.
- Do not add app-specific HTML paths.
- Cover representative title/body rendering with website integration tests.

## Add representation negotiation

- Define request and response shapes for choosing native, Markdown, ATJSON, or HTML representations.
- Keep `variant` as the semantic slice and `content_type` as the representation discriminator.
- Document fallback order and unsupported representation behavior.

## Decide native storage policy

- Decide whether native exports remain durable rows or become derived output.
- Capture debugging, fidelity, and storage-cost tradeoffs.
- Document migration requirements before removing any native row.
