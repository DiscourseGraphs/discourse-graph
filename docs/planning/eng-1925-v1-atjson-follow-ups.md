# ENG-1925 v1 ATJSON follow-up drafts

These are ticket drafts to create after v0 inspection. They do not expand the v0 rollout scope. Each draft treats renderer parity as a prerequisite for changing a reader or removing a native representation.

## 1. Prefer canonical ATJSON in content readers

**Problem:** Readers currently request native representations explicitly. Canonical ATJSON cannot become the preferred read without a predictable compatibility fallback.

**Scope:** Add ordered representation preferences to shared readers, select canonical ATJSON only for supported schema versions, and fall back to the current native content type when canonical content is absent or invalid. Add selection telemetry and fixtures for mixed-version rows.

**Done when:** Website, Roam, and Obsidian readers use the same selection contract; unsupported ATJSON never blocks a native read; selection is covered at the API and client layers.

**Renderer parity gate:** Do not enable ATJSON-first reads until both host renderers pass the existing native adapter fixtures, semantic round-trip tests, malformed-document fallback tests, and the host workflow matrix in ENG-1924 with no regression from the Markdown baseline.

## 2. Materialize canonical ATJSON into Obsidian Markdown

**Problem:** Obsidian import deliberately reads native Markdown. It cannot consume a canonical-only source yet.

**Scope:** Implement `DgDocument` to Obsidian Markdown materialization, including title/body boundaries, nested blocks, wikilinks, external links, code, emphasis, tags, and an explicit policy for unsupported annotations. Preserve frontmatter and file-reference behavior outside the canonical document.

**Done when:** Canonical-only fixtures import into an isolated vault, edits remain stable after republish, unsupported annotations produce documented degradation instead of silent corruption, and native Markdown remains a fallback.

**Renderer parity gate:** Compare generated Markdown and rendered Obsidian behavior against the current native import fixtures. Require semantic equivalence for every supported annotation plus explicit snapshots for every accepted fidelity loss before any reader preference changes.

## 3. Materialize canonical ATJSON into Roam blocks

**Problem:** Roam materialization deliberately reads native Roam or Obsidian Markdown. It cannot reconstruct a node from canonical-only content.

**Scope:** Implement `DgDocument` to Roam block-tree materialization with stable nesting, page/block references, aliases, embeds, attributes, code, and formatting. Define idempotent refresh behavior and an unsupported-annotation policy.

**Done when:** Canonical-only fixtures create and refresh the expected Roam tree without duplicate blocks, references resolve correctly, and native Markdown remains a fallback.

**Renderer parity gate:** The generated block tree must match the semantic output of the current Markdown materializer across adapter fixtures and live Roam validation. Do not switch readers until nesting, references, attributes, and refresh behavior meet or exceed the native baseline.

## 4. Publish sanitized HTML from canonical ATJSON

**Problem:** Publishing lacks a canonical renderer that is deterministic, link-aware, and safe for untrusted content.

**Scope:** Extend the package HTML renderer with a resolver contract for internal references and embeds, an allowlisted sanitization policy, stable heading/anchor behavior, and accessible semantic markup. Keep rendering pure so Website publishing can cache its output.

**Done when:** Golden fixtures cover every supported annotation, malicious inputs are neutralized, unresolved references degrade visibly, and Website publishing consumes the package renderer without app-specific document parsing.

**Renderer parity gate:** HTML snapshots and browser accessibility checks must preserve all semantics supported by the Obsidian and Roam renderers. Any host-only construct needs an explicit HTML fallback and an accepted fidelity note before HTML becomes a publishing default.

## 5. Negotiate content representations at the API boundary

**Problem:** The v0 resolve endpoint accepts an explicit list but does not define reusable preference, version, or fallback semantics for future representations.

**Scope:** Specify ordered preferences, schema-version compatibility, response provenance, fallback reasons, cache variation, maximum request size, and error behavior. Update the shared API client and add contract tests for mixed native/canonical storage.

**Done when:** A client can ask for a preferred representation without silently receiving an incompatible version; responses identify the selected representation; fallback behavior is deterministic and observable.

**Renderer parity gate:** Negotiation may expose canonical content for opt-in experiments, but default preferences must remain native until the target host renderer passes its parity suite. The API must provide a native fallback throughout staged rollout and rollback.

## 6. Define the post-parity native storage policy

**Problem:** Dual-write is safe for v0 but leaves open how long native rows remain authoritative, how `original` and file references behave, and whether native content can ever be derived or removed.

**Scope:** Decide authority and retention per host, update conflict keys and provenance metadata, define file-reference ownership, specify backfill and rollback, and measure storage/write amplification. Include migration behavior for legacy `text/obsidian+markdown` rows.

**Done when:** The policy states which representation is authoritative for every write/import path, preserves file references, defines reversible migrations, and provides operational checks for drift between canonical and native rows.

**Renderer parity gate:** Do not delete, demote, or derive an original native row until all consuming renderers pass parity, live host validation is complete, drift monitoring is in place, and a tested rollback can restore native-first reads without data loss.
