---
title: "Bulk identify discourse nodes"
date: "2026-08-11"
author: ""
published: true
---

If your vault already contains notes that follow a discourse node naming convention — for example titles like `CLM - Coral bleaching is accelerating` — you can identify them as discourse nodes all at once instead of converting them one by one.

**Bulk identify discourse nodes** scans your vault for notes whose **titles** match the patterns you choose, lets you review the matches, and then tags the ones you select with the right node type.

This is a local operation on your own vault. It is unrelated to [Sync and import](/docs/obsidian/advanced-features/sync-and-import), which shares nodes with collaborators through the Discourse Graph database.

## Before you start

Set up your [node types](/docs/obsidian/configuration/node-types-templates) first. The scan can only match against node types that already exist in your settings, and it uses each type's configured format as the starting pattern.

## Run the bulk identification

### Step 1: Open the command

1. Open the command palette with `Cmd/Ctrl + P`
2. Search for "Bulk" and select **Discourse Graph: Bulk identify discourse nodes**

![Bulk identify command in palette](/docs/obsidian/bulk-identify-command.png)

### Step 2: Configure identification patterns

The modal opens on **Configure Identification Patterns**, listing every node type in your settings. All types start disabled.

1. Tick the node types you want to scan for, or click **Enable All**
2. Each enabled type shows an editable pattern, pre-filled with that type's configured format
3. Adjust the pattern if your notes use a different convention than your node type format. Use `{content}` as the placeholder for the note's main text — for example, set the pattern to `C - {content}` if your existing claim notes are titled that way instead of `CLM - {content}`
4. Click **Scan Vault**

![Configure identification patterns](/docs/obsidian/bulk-identify-patterns.png)

**Scan Vault** stays disabled until at least one node type is enabled.

#### How patterns are matched

- Patterns match a note's **title only**. Note content is never scanned.
- The pattern must match the **whole title**, from start to end. `CLM - {content}` matches `CLM - Coral bleaching is accelerating`, but not `Draft: CLM - Coral bleaching is accelerating`.
- `{content}` stands in for any text.
- Everything outside `{content}` is matched literally, so spacing and punctuation must line up exactly.
- Notes that already carry one of your configured node types are skipped, so re-running the scan will not produce duplicates.
- If a title matches more than one enabled pattern, the first match wins, following the order your node types appear in settings.

> **Note:** Patterns are plain title formats, not regular expressions. Formats containing characters such as `(`, `)`, `*`, or `|` may not match as expected. Prefer simple prefixes and separators like `CLM - {content}`.

### Step 3: Review candidates

The **Review candidates** step shows how many matches were found, grouped by the folder each note lives in. Notes in the vault root appear under **(Root)**.

1. Tick individual notes, tick a folder header to toggle everything inside it, or click **Select All**
2. Click **Identify selected as discourse nodes** — the button shows the number currently selected

![Review candidates](/docs/obsidian/bulk-identify-review.png)

Nothing is selected by default, and the confirm button stays disabled until you select at least one note. Click **Back** to return to the patterns step and adjust your patterns.

### Step 4: Wait for processing

A progress bar reports how many files have been processed. When the run finishes, a notice confirms how many notes were identified, along with how many were skipped if any failed.

![Identification complete notice](/docs/obsidian/bulk-identify-success.png)

## What identification changes

Identifying a note adds a `nodeTypeId` field to its frontmatter. That is the only change.

Notes keep their existing titles and stay in their current folders. They are **not** renamed to your node type format, **not** moved into the node folder set in [General settings](/docs/obsidian/configuration/general-settings), and **not** given the [node template](/docs/obsidian/configuration/node-types-templates#working-with-templates) for their type. No other frontmatter is touched.

> **Warning:** There is no bulk undo. To reverse an identification, remove the `nodeTypeId` field from the affected notes yourself, or restore them from a backup or version control. Consider running the scan on a small selection first to confirm your patterns behave the way you expect.

## Troubleshooting

- **No candidates found** — Check that the pattern matches the full title, including spacing around separators. A pattern of `CLM -{content}` will not match a note titled `CLM - Coral bleaching is accelerating`.
- **Notes you expected are missing from the list** — They may already be identified as discourse nodes. Notes with a node type already set are excluded from the scan.
- **A note was matched as the wrong type** — Two enabled patterns overlapped. Disable the competing node type and scan again, or make the patterns more specific.
- **"Problem processing [note]'s frontmatter. Preserved original content."** — The plugin could not update the note's existing frontmatter, so it added a new frontmatter block instead and kept the note's content intact. Open the note to check the result.
- **"Failed to process [note]. Skipping..."** — The note could not be written to and was left unchanged. Identify it individually using the **Convert into** flow described in [Creating discourse nodes](/docs/obsidian/core-features/creating-discourse-nodes#convert-an-existing-page-into-a-discourse-node).

## Related

- [Creating discourse nodes](/docs/obsidian/core-features/creating-discourse-nodes) — convert a single note into a discourse node
- [Node types and templates](/docs/obsidian/configuration/node-types-templates) — set up the formats the scan matches against
