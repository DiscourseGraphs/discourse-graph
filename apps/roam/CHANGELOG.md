# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project does not follow [Semantic Versioning](https://semver.org/), here's what we do instead:

- Major version bumps are very rare and we reserve them for special changes that signify a paradigm shift of some kind.
- Minor version bumps are released on a regular cadence.
- Patch version bumps are for bugfixes and hotfixes.

## [0.17.0] – 2026-02-08

### Added

- **Create Node flow** — new consolidated node creation experience in Roam
- **Canvas: paste references into canvas** — paste block or page references directly into the canvas
- **Canvas: drag-and-drop blocks** — drag Roam blocks directly into the canvas
- **Node colors in settings** — show node colors for nodes via settings

### Changed

- **Discourse Context placement** — move context panel to top of discourse node pages
- Node Summoning Menu - collapse filter menu behavior after clicking "only"
- **Canvas** — Upgrade tldraw to 2.4.0

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
- **Canvas:** inconsistent “send nodes to canvas” behavior
- **Relations:** prevent moving the entire relation arrow; drag only changes bend in Roam

## [0.15.0] - 2025-12-24

### Added

#### Node Tags

- You can now designate special hashtags as **Node Tags** to automatically treat those blocks as Discourse Graph nodes.
- For example, tagging a block with `#Evidence` or `#Claim` will formalize it as an Evidence/Claim node in the graph.
- Node Tags are:
  - Configurable in the plugin settings (with **Evidence** and **Claim** provided as defaults).
  - Visually distinct with color-coding.
  - Supported on images — allowing images to function as nodes.

#### Left Sidebar for Favorites

- A new **Favorites Sidebar** helps you organize important pages and blocks.
- Features include:
  - The ability to favorite pages or blocks.
  - Custom nicknames (aliases) for any item.
  - Grouping favorites into custom user-defined sections.
  - Drag-and-drop reordering.
- Fully customizable per user — great for multiplayer workspaces.

#### Node Search Menu Improvements

- The node-summoning menu now supports:
  - **Multi-select filtering**, allowing multiple filters/tags to narrow results.
  - A new default trigger key: `@` — for easier and quicker access.

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

- We’ve upgraded to **tldraw v2.3.0** — a major update:
  - You’ll be prompted to migrate your canvases when reopening them.
  - Contact us if you experience any migration issues.
- Additional enhancements:
  - You can now open the canvas in the **Roam sidebar** for split-view editing.
  - The new **Canvas Clipboard panel** allows drag-and-drop from a node list into the canvas.
  - Support for `.webp` image files has been added — these now display properly.
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

- Fixed an issue where canvases would get stuck at **“Loading…”**
- Resolved compatibility problems with the **Roam Highlighter** extension.
- Fixed a bug where the node-summoning menu sometimes missed relevant results.
- Multiple Query Builder issues resolved:
  - Column resizing bugs
  - Multiple input handling
- Numerous additional bug fixes, UI improvements, and performance upgrades for a smoother overall experience.
