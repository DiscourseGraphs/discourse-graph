# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project does not follow [Semantic Versioning](https://semver.org/), here's what we do instead:

- Major version bumps are very rare and we reserve them for special changes that signify a paradigm shift of some kind.
- Minor version bumps are released on a regular cadence.
- Patch version bumps are for bugfixes and hotfixes.

## [0.21.0] - 2026-06-22

### Changed

- **Build metadata includes the commit SHA** - Release builds now stamp version metadata with the build commit, and branch builds keep the date/branch/commit format.
- **Per-install Roam extension version telemetry** - Extension load analytics now include per-install version metadata to help debug Roam app dev URL caching.
- **Canvas shape nodes use discourse-node** - Canvas shape nodes now use the shared `discourse-node` type instead of the old `node-type` identifier.
- **Legacy anchor-backed node types removed** - Canvas node type handling no longer includes the unused legacy anchor path.

### Fixed

- **Color picker writes are debounced** - Dragging the discourse node color picker now updates the UI immediately but saves the final color after a short pause instead of writing on every change.

## [0.20.0] - 2026-06-21

### Added

- **Advanced search (BETA, behind admin flag)** - New node search dialog with filtering, sorting, preview, result insertion, and opening results in the main panel or right sidebar.
- **Canvas sharing** - Share Data now appears in the canvas selection menu for selected discourse nodes.
- **Convert existing page to node** - Command palette action to turn an existing page into a discourse node.

### Changed

- **Custom favorites in sidebar** - Query sections render in the sidebar, and drag reorders now persist.
- **Custom favorites in sidebar** - Global and personal settings tabs stay hidden when the left sidebar feature is off, and the global section starts open when it has children.
- **SmartBlocks in Custom favorites in sidebar** - SmartBlocks render as clickable items in the left sidebar.
- **Canvas shortcuts** - Per-user canvas keyboard shortcuts now work with the new settings flow.
- **Canvas embed** - Embedded canvas selection now works with the mouse, and duplicate node-type shortcuts are no longer assigned.

### Fixed

- **Image resizing** - Image controls no longer overlap the resize handle.
- **Suggestion mode** - Reflow on first load is corrected, and searching from all pages works again.
- **Node type menu** - The node type menu now scrolls when there are many node types.
- **Create relation flow** - The relation dialog no longer closes when there is no match, and incomplete relation types no longer crash the canvas.
- **Template editing** - Changing a node template no longer fails with a duplicate block error.
- **Search result tags** - Search result tags no longer show a leading `#`.
- **Roam sync** - Missing concepts are recovered during sync, and page-load observer paths no longer repeat settings reads as often.

## [0.19.0] - 2026-05-11

### Added

- **Left sidebar commands** - add custom sidebar commands, starting with Create Node
- **Canvas relations** - add relation creation through drag handles in tldraw
- **Canvas clipboard** - add filtering, searching, and sorting controls

### Changed

- **Create Node flow** - improve the node creation dialog with longer titles, title-first field order, highlighted-text prefills, empty node-type selection, and safer node-type locking
- **Node settings** - show node tags below the tag input and move node color selection into the General tab

### Fixed

- **Discourse Context overlay** - fix overlay cleanup and repeated hover triggering in rendered query blocks
- **Large graph syncs** - batch concept upserts to reduce sync timeouts on large graphs
- **Roam observers** - prevent duplicate page-reference observers from being registered
- **Discourse Context settings** - fix settings blocks appearing in pages after using Hide Interface
- **Canvas text** - fix canvas nodes unexpectedly defaulting to the Draw font
- **Canvas embeds** - improve block embed click behavior

## [0.18.0] - 2026-03-29

### Added

- **Create Node command** - add a dedicated discourse node creation command in Roam
- **Canvas clipboard awareness** - show or hide nodes that are already on the canvas and support formalizing candidate nodes directly from canvas embeds
- **Real-time canvas migration** - add an explicit sync mode and migration path from local canvases to real-time canvases

### Changed

- **Left sidebar** - allow adding blocks to custom favorites in the sidebar
- **Stored relations settings** - move stored-relations controls into Personal Settings and make the migration flow more user-facing
- **Canvas relations** - improve relation-arrow labeling and keep the relation tool flow active after creating a relation
- **Canvas refresh** - update canvas node titles when source page titles change
- **Query Builder** - improve DNP detection and support `is in canvas` for newer canvas schemas

### Fixed

- **Canvas stability** - fix multiple canvas loading and runtime errors, including old canvases failing to open and asset metadata crashes
- **Create Node flow** - fix node-type mismatches, focus-jump issues, unbounded search results, and incorrect `@source` title handling
- **Canvas tools** - fix tool-lock behavior for the discourse tool
- **Performance** - fix a slow sync or query regression caused by discourse-node change detection
- **Query Builder** - fix column layout preferences not being preserved
- **Release build** - fix the official deployment build missing required database environment variables
- **Canvas titles** - fix incorrect auto-generated page titles when a canvas is opened in the right sidebar

## [0.17.0] - 2026-02-08

### Added

- **Create Node flow** - new consolidated node creation experience in Roam
- **Canvas: paste references into canvas** - paste block or page references directly into the canvas
- **Canvas: drag-and-drop blocks** - drag Roam blocks directly into the canvas
- **Node colors in settings** - show node colors for nodes via settings

### Changed

- **Discourse Context placement** - move context panel to top of discourse node pages
- Node Summoning Menu - collapse filter menu behavior after clicking "only"
- **Canvas** - Upgrade tldraw to 2.4.0

### Fixed

- **Canvas**
  - Fix incorrect image sizing after Canvas 2.3.0 upgrade
  - Remove Discourse Overlay from `@source` titles where inappropriate
- **Relations & nodes**
  - Improve handling of incomplete or missing node definitions
  - Improve character handling in node titles (bold, italic, namespaced, etc)
- Misc
  - Standardized terminology in settings and documentation

## [0.16.0] - 2026-01-11

### Added

- **Base JSON-LD export**
- **Canvas clipboard:** add a canvas page to the clipboard to view all nodes on that canvas
- **Left sidebar:** allow editing of section names
- **Query Builder:** column view "render" added, uses `renderString` API to render links, block references, etc

### Changed

- **Query metadata is hidden by default**, plus a command palette command to toggle it
- **Performance:** optimize discourse node page observer checks

### Fixed

- **Discourse Context Overlay:**
  - fix failure to add reified relations from the overlay
  - component not loading
- **Canvas:** inconsistent "send nodes to canvas" behavior
- **Relations:** prevent moving the entire relation arrow; drag only changes bend in Roam

## [0.15.0] - 2025-12-24

### Added

#### Node Tags

- You can now designate special hashtags as **Node Tags** to automatically treat those blocks as Discourse Graph nodes.
- For example, tagging a block with `#Evidence` or `#Claim` will formalize it as an Evidence/Claim node in the graph.
- Node Tags are:
  - Configurable in the plugin settings (with **Evidence** and **Claim** provided as defaults).
  - Visually distinct with color-coding.
  - Supported on images - allowing images to function as nodes.

#### Left Sidebar for Favorites

- A new **Favorites Sidebar** helps you organize important pages and blocks.
- Features include:
  - The ability to favorite pages or blocks.
  - Custom nicknames (aliases) for any item.
  - Grouping favorites into custom user-defined sections.
  - Drag-and-drop reordering.
- Fully customizable per user - great for multiplayer workspaces.

#### Node Search Menu Improvements

- The node-summoning menu now supports:
  - **Multi-select filtering**, allowing multiple filters/tags to narrow results.
  - A new default trigger key: `@` - for easier and quicker access.

#### Quick Toggle for Context Overlay

- You can now toggle the **Discourse Context Overlay** directly from the command palette.
- This provides a faster way to show/hide the overlay without adjusting settings manually.

#### Revamped Help Menu

- The in-app help interface has been redesigned:
  - The **Send Feedback** button is now a floating action button (FAB) with the Discourse Graph logo.
  - The Help menu UI includes cleaner styling and new hover effects.

#### Query Builder Enhancements

- Significant usability improvements:
  - Search filters in query results are now persistent.
  - The "Rows per page" control is now in a dropdown menu.
  - Queries now support multiple `:in` input variables simultaneously.
  - Columns can be hidden via the new **Column Views** feature.

#### Canvas & Visualization Updates

- We've upgraded to **tldraw v2.3.0** - a major update:
  - You'll be prompted to migrate your canvases when reopening them.
  - Contact us if you experience any migration issues.
- Additional enhancements:
  - You can now open the canvas in the **Roam sidebar** for split-view editing.
  - The new **Canvas Clipboard panel** allows drag-and-drop from a node list into the canvas.
  - Support for `.webp` image files has been added - these now display properly.
  - A new setting allows you to disable **auto-adding discourse relations** when adding a node to the canvas.
  - The canvas drawer has been moved inside the tldraw interface.

#### Streamline Styling Toggle

- A new optional visual mode offers a refined appearance for:
  - Page references
  - Checkboxes
  - Sidebar
  - Tables
  - Other UI elements

#### Telemetry Controls

- Added a **Disable Telemetry** toggle in Personal Settings.
- Lets you opt out of:
  - Error logging
  - Minimal activity tracking
- Note: we use telemetry strictly to identify bugs and improve plugin quality.

### Fixed

- Fixed an issue where canvases would get stuck at **"Loading..."**
- Resolved compatibility problems with the **Roam Highlighter** extension.
- Fixed a bug where the node-summoning menu sometimes missed relevant results.
- Multiple Query Builder issues resolved:
  - Column resizing bugs
  - Multiple input handling
- Numerous additional bug fixes, UI improvements, and performance upgrades for a smoother overall experience.
