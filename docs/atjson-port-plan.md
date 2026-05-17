# SamePage to Discourse Graphs content-model port

## Summary

This document scopes the SamePage ATJSON port into a Discourse Graphs-owned shared package.

The immediate goal is to make **one canonical content model in code** that:

- accepts content from Roam
- accepts content from Obsidian
- stores portable semantics in a DG-owned ATJSON-compatible shape
- renders that canonical shape back to Roam
- renders that canonical shape back to Obsidian
- renders that canonical shape to HTML for future website publishing

The goal is **not** to port SamePage wholesale. We are only porting the document model, parser and renderer patterns, and app adapters that are useful for Roam, Obsidian, and HTML.

Canonical storage rollout is tracked separately in `docs/atjson-canonical-storage-plan.md`. That storage plan records the later decision that `variant` is the semantic content slice and `Content.content_type` is the representation format. This file remains the architecture plan for the DG-owned content-model package and conversion adapters.

## Prompt corrections

The original prompt mixes two different initiatives. They should be treated separately.

### Initiative A: canonical content model in code

This is the main effort in this document.

- Create a new shared package under `packages/content-model`
- Define the canonical schema and validators
- Add generic parser and renderer utilities
- Add Obsidian adapters
- Add Roam adapters
- Add direct HTML rendering from the canonical model
- Wire apps to the shared package with thin integration layers

### Initiative B: canonical storage and content negotiation

This is now split into two parts:

- Initiative B1: write-only canonical ATJSON storage, documented in `docs/atjson-canonical-storage-plan.md`
- Initiative B2: later read-path/content negotiation, after app renderers have parity tests

The decided B1 storage shape is:

- `variant` remains the semantic slice of a node, such as `direct`, `full`, or `direct_and_description`
- `Content.content_type` becomes the representation format, such as `text/plain`, `text/markdown`, or `application/vnd.discourse-graph.atjson+json; version=1`
- ATJSON is initially written alongside existing rows, with the structured document stored in `Content.metadata` and a derived plain-text projection stored in `Content.text`
- Existing readers keep using the current text and Markdown rows

This split is important because the current repo uses `Content.text` for text search, discovery, and embeddings, while app-native payloads are still organized by content variants. Write-only ATJSON storage can land before destination renderers are active, but API negotiation and ATJSON-preferred import should wait for renderer parity.

## Estimated effort

These estimates assume **LLM-assisted implementation** for the initial porting work.

That means LLMs are used for:

- package scaffolding
- first-pass translation of SamePage parser and renderer patterns
- generation of repetitive type definitions and tests
- drafting Roam and Obsidian adapter code from the reference repos

The estimates still assume human engineering time for:

- design decisions
- integration into this repo
- debugging edge cases
- validating round-trip fidelity
- writing and fixing tests
- code review and cleanup

### Expected engineering hours

#### Initiative A: canonical content model in code

| Slice | Scope                                            | Estimated hours |
| ----- | ------------------------------------------------ | --------------: |
| 1     | Package scaffold, schema, validators, core tests |            6-10 |
| 2     | Generic parser and renderer core                 |            8-14 |
| 3     | Obsidian adapter and tests                       |           12-20 |
| 4     | Roam adapter and tests                           |           14-24 |
| 5     | HTML renderer and tests                          |             4-8 |
| 6     | Integration pass in apps and migration notes     |            8-16 |
|       | **Subtotal**                                     |       **52-92** |

#### Initiative B: storage and API tracks

| Slice | Scope                                                                                              | Estimated hours |
| ----- | -------------------------------------------------------------------------------------------------- | --------------: |
| 7A    | Write-only ATJSON storage with `Content.content_type`, migrations, and app writer updates          |           12-24 |
| 7B    | ATJSON-preferred destination reads, content negotiation, and Markdown/HTML representation handling |           12-24 |
|       | **Subtotal**                                                                                       |       **24-48** |

#### Overall estimate

- **Code-first implementation only**: about **52-92 engineer hours**
- **Including storage and API tracks**: about **76-140 engineer hours**

### Planning assumptions behind the estimate

- LLMs can likely remove about **25-40%** of the low-level porting and boilerplate effort.
- LLMs do **not** remove most of the cost of integration, review, debugging, and round-trip correctness testing.
- The estimate assumes we are **porting from existing SamePage code**, not inventing the parsers and renderer from scratch.
- The estimate also assumes we are porting only the relevant document-model pieces, not the excluded SamePage sync, transport, or Automerge layers.
- Roam and Obsidian edge cases will likely dominate the uncertainty.
- The estimate assumes one engineer driving the work with fast feedback, not a long review queue.
- If write-only storage is implemented in parallel with adapter work, keep it behind the current text and Markdown read paths and expect coordination overhead near the high end of the estimate.

## Scope

### In scope

- A DG-owned shared package for the canonical content model
- Top-level `title` and `body` split
- Portable annotation definitions
- Generic parser and renderer helpers inspired by SamePage
- Roam to canonical content conversion
- Canonical content to Roam conversion
- Obsidian to canonical content conversion
- Canonical content to Obsidian conversion
- Canonical content to HTML rendering
- Unit tests and round-trip tests
- Migration notes for future contributors

### Out of scope

- SamePage networking
- websockets
- IPFS
- Automerge sync logic
- SamePage local database code
- SamePage protocol code
- SamePage runtime schema ownership
- a standalone general Markdown transport beyond what is required for the Obsidian adapter
- ATJSON-preferred import, API negotiation, and destination read-path changes in the first content-model package pass

## Package decision

The new package should be:

- path: `packages/content-model`
- package name: `@repo/content-model`

This name makes the package purpose clear while still allowing the package to be ATJSON-oriented internally.

## Target architecture

`@repo/content-model` owns:

- canonical schema and exported types
- annotation definitions
- title and body document split
- validators
- parser and renderer helpers
- Roam adapters
- Obsidian adapters
- HTML rendering

`apps/roam` should only own:

- thin Roam integration
- access to Roam APIs
- any unavoidable Roam-only wiring

`apps/obsidian` should only own:

- thin Obsidian integration
- access to Obsidian APIs
- any unavoidable Obsidian-only wiring

`apps/website` should later consume canonical HTML output rather than building a separate Roam-specific or Obsidian-specific publishing path.

## Canonical document design

The canonical document should be a DG-owned ATJSON-compatible structure with a strict top-level split between title and body.

### Top-level type

```ts
type DgDocument = {
  version: "dg-content-model/v1";
  title: TextDocument;
  body: BodyDocument;
  metadata?: JsonObject;
};
```

### Text containers

```ts
type TextDocument = {
  text: string;
  annotations: InlineAnnotation[];
};

type BodyDocument = {
  text: string;
  annotations: BodyAnnotation[];
};
```

`title` should only contain inline annotations.

`body` should contain:

- block structure
- inline formatting
- links
- images
- references
- optional app-specific fidelity attributes

### Annotation set

The v1 canonical annotation set should include:

- `block`
- `bold`
- `italics`
- `strikethrough`
- `code`
- `link`
- `image`
- `reference`

Every annotation should include:

```ts
type AnnotationBase = {
  start: number;
  end: number;
  appAttributes?: Record<string, JsonObject>;
};
```

### Block annotation

Block annotations should carry explicit hierarchy information instead of relying only on indentation depth.

```ts
type BlockAnnotation = AnnotationBase & {
  type: "block";
  attributes: {
    blockId: string;
    parentBlockId?: string;
    depth: number;
    viewType: "paragraph" | "bullet" | "numbered";
  };
};
```

This is an intentional divergence from SamePage. SamePage used `level` and `viewType`; Discourse Graphs should keep `depth` but also carry explicit block identity and parent linkage so block hierarchy is reconstructable without relying on positional inference alone.

### Inline annotations

```ts
type BoldAnnotation = AnnotationBase & {
  type: "bold";
  attributes?: {
    delimiter?: string;
    open?: boolean;
  };
};

type ItalicsAnnotation = AnnotationBase & {
  type: "italics";
  attributes?: {
    delimiter?: string;
    open?: boolean;
  };
};

type StrikethroughAnnotation = AnnotationBase & {
  type: "strikethrough";
  attributes?: {
    delimiter?: string;
    open?: boolean;
  };
};

type CodeAnnotation = AnnotationBase & {
  type: "code";
  attributes: {
    language?: string;
    ticks?: number;
    display?: "inline" | "block";
  };
};

type LinkAnnotation = AnnotationBase & {
  type: "link";
  attributes: {
    href: string;
    title?: string;
  };
};

type ImageAnnotation = AnnotationBase & {
  type: "image";
  attributes: {
    src: string;
    alt?: string;
    title?: string;
  };
};
```

### Reference annotation

References should be explicit and typed.

```ts
type ReferenceAnnotation = AnnotationBase & {
  type: "reference";
  attributes:
    | {
        kind: "roam-page";
        pageTitle: string;
        pageUid?: string;
      }
    | {
        kind: "roam-block";
        blockUid: string;
      }
    | {
        kind: "obsidian-wikilink";
        path: string;
        subpath?: string;
        alias?: string;
      };
};
```

Generic URL links should remain `link` annotations, not `reference` annotations.

### Validation rules

The shared package should provide validators that:

- reject negative spans
- reject zero-length spans
- reject spans that exceed document length
- reject block parents that do not exist
- reject `title` documents that contain block annotations
- validate `reference.kind`-specific attributes

## Module boundaries

The package should expose these modules:

- `@repo/content-model/schema`
- `@repo/content-model/validate`
- `@repo/content-model/core`
- `@repo/content-model/adapters/obsidian`
- `@repo/content-model/adapters/roam`
- `@repo/content-model/render/html`

Recommended internal structure:

- `src/schema.ts`
- `src/annotations.ts`
- `src/validate.ts`
- `src/core/parser.ts`
- `src/core/render.ts`
- `src/core/annotations.ts`
- `src/adapters/obsidian/fromObsidian.ts`
- `src/adapters/obsidian/toObsidian.ts`
- `src/adapters/roam/fromRoam.ts`
- `src/adapters/roam/toRoam.ts`
- `src/render/toHtml.ts`

## Implementation slices

### Slice 1: package scaffold and canonical schema

Deliver:

- package scaffold under `packages/content-model`
- exported document and annotation types
- validators
- tests for title and body documents
- tests for nested and overlapping annotations
- tests for block hierarchy representation
- tests for reference variants

Notes:

- Do not implement app adapters yet
- Do not add backend storage changes yet

### Slice 2: generic parser and renderer core

Deliver:

- simplified DG-owned parser helpers
- annotation combination helpers
- renderer runtime for annotation application
- tests for annotation ordering and nested rendering

Notes:

- Port the reusable ideas from SamePage
- Do not carry over sync-specific or protocol-specific machinery
- Avoid overfitting to a single app

### Slice 3: Obsidian adapter

Deliver:

- `fromObsidian`
- `toObsidian`
- tests for paragraphs, bullets, numbered lists, code fences, links, images, and wikilinks
- minimal integration points in `apps/obsidian`

Notes:

- Keep the title and body split explicit
- Use `appAttributes` only where portable attributes cannot preserve full fidelity

### Slice 4: Roam adapter

Deliver:

- `fromRoam`
- `toRoam`
- tests for page title, block hierarchy, page refs, block refs, links, images, and code fences
- minimal integration points in `apps/roam`

Notes:

- Do not collapse page refs and block refs into the same vague type
- Preserve Roam-specific fidelity with `appAttributes` only where necessary

### Slice 5: HTML renderer

Deliver:

- `toHtml`
- tests for representative title and body documents
- clear semantic mapping from canonical content to HTML

Notes:

- There should be one canonical HTML path
- Do not implement separate Roam-to-HTML and Obsidian-to-HTML renderers
- Next.js can consume the HTML output later

### Slice 6: app integration pass

Deliver:

- thin app wiring in `apps/roam`
- thin app wiring in `apps/obsidian`
- removal or isolation of duplicated parsing and rendering logic where the shared package should be canonical
- migration notes

Notes:

- Keep the current backend upload model working during this phase
- Do not combine destination renderer rollout with a storage migration
- If write-only storage lands in parallel, follow `docs/atjson-canonical-storage-plan.md` and keep current readers on text and Markdown rows

### Slice 7: storage and API tracks

Deliver:

- write-only canonical backend storage as a separate track, using `Content.content_type`
- later representation negotiation for future content APIs
- migration plan for existing plain text and Markdown content rows

Notes:

- Write-only storage has a concrete plan in `docs/atjson-canonical-storage-plan.md`
- ATJSON rows store the canonical structured document in `Content.metadata`
- `Content.text` stores a derived plain-text projection for search, discovery, and fallback display
- `Content.content_type` distinguishes `text/plain`, `text/markdown`, and DG ATJSON
- Do not move app import paths to ATJSON until renderer parity tests exist

## Test plan

The shared package should have package-local tests that cover:

- valid `title` and `body` documents
- invalid spans and invalid block parents
- nested inline annotations
- overlapping annotations where ordering matters
- block hierarchy reconstruction
- explicit reference kind variants
- generic renderer ordering behavior
- Obsidian round-trips
- Roam round-trips
- HTML rendering for representative canonical documents

## Intentional divergences from SamePage

The DG implementation should intentionally diverge from SamePage in these places:

- no `SamePageSchema` as the canonical runtime type
- no Automerge counters or Automerge-specific schema shape
- no SamePage content type version header
- no metadata annotation for the title
- explicit top-level `title` and `body`
- explicit block identity and parent linkage
- app-specific attributes are an escape hatch, not the primary semantics

## Open questions for later phases

These are intentionally not part of the first content-model package implementation pass:

- whether `Content.text` remains the long-term search and embedding source or is always derived from canonical content
- how `GET` content APIs should negotiate ATJSON, HTML, and Markdown
- whether Markdown becomes a first-class standalone transport outside the Obsidian adapter

Resolved storage decision:

- canonical ATJSON initially lives in `Content.metadata`, not as serialized JSON in `Content.text`
- `Content.text` on ATJSON rows is a derived plain-text projection
- `Content.content_type` distinguishes ATJSON from text and Markdown
- `variant` remains the semantic slice, not the representation format
