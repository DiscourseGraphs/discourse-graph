<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/1a448567-c799-489e-bdc4-e708c280b18e">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/3abbf462-d6dc-4e8f-b40a-d668d250d424">
  <img alt="Shows project promo image in light and dark mode">
</picture>

# Overview

Break down the research process into atomic units to augment the knowledge synthesis process. Create distinct objects for questions, claims, evidence, hypotheses or choose your own to suit your specific needs. These objects can then be related, resurfaced, and reused throughout your research journey to help you efficiently build arguments and create new knowledge.

# Documentation
For more information about Discourse Graphs, check out [our website](https://discoursegraphs.com) and [documentation](https://discoursegraphs.com/docs/obsidian/getting-started).

# Installation

Follow the instructions below to install the plugin:

## Install BRAT

To use the plugin prior to it's public release on Obsidian's community plugin browser, install BRAT (Beta Reviewer's Auto-update Tester).

1. Open Obsidian Settings
2. Go to Community Plugins and disable Restricted Mode
3. Click "Browse" and search for "BRAT"
4. Install BRAT and enable it

## Install DataCore via BRAT

1. Add the DataCore plugin from the BRAT settings menu or run command "Add a beta plugin for testing"
2. Enter the repository URL: `https://github.com/blacksmithgu/datacore` and choose "Latest version"
3. Check the box for "Enable after installing the plugin"
4. Click `Add plugin`

## Install Discourse Graphs

1. Add the Discourse Graphs plugin from the BRAT settings menu or run command `Add a beta plugin for testing`
2. Enter the repository URL: `https://github.com/DiscourseGraphs/discourse-graph-obsidian` and choose "Latest version"
3. Check the box for "Enable after installing the plugin"
4. Click `Add plugin`

# Getting started

The Discourse Graphs plugin gives you the ability to add additional semantic structure to your notes via specified page types (nodes) and relation types that model scientific discourse and enable more complex and structured [knowledge synthesis work](https://oasislab.pubpub.org/pub/54t0y9mk/release/3).

The plugin ships with several node types to provide a foundation for your scientific argumentation: Question, Claim, Evidence, and Source, as well as complementary relation types that can be used between them.

To see the default settings or begin adding your own node and relation types, open the Discourse Graphs plugin settings menu by navigating to it in Obsidian's settings menu or using the command: "Open Discourse Graphs Settings"

## Defining node types

To define a new node type for use in your vault navigate to the Node Types menu and click `Add Node Type`. Doing so will take you to an editing menu where you can choose the details of your new node type including it's title, a description, a template to use, a color to represent that type in your vault, and more.

## Defining relation types

The Discourse Graphs plugin ships with three default relation types: `supports`, `opposes`, and `informs`. You can add your own in the Relation Types menu by clicking the `Add relation type` button and filling out the text fields that define your new type.

## Defining relations

With nodes and relation types ready, the last step is to connect them in the Discourse Relations menu. Click `Add Relation` then choose a source node, relation type, target node, and then click `Save Changes`. These relations are now ready to use in your notes and canvases.

# Usage

## In notes

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/85bfcced-5627-4e38-ac54-588bf37df2d4">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/f3e27e4a-d50e-4634-905c-32fbca6b4eac">
  <img alt="Shows project promo image in light and dark mode">
</picture>

### Creating nodes

There are three ways to create nodes in a note:

_Turn text into a node with the node type text menu_

1. Highlight the text that you want to turn into a node
2. Use the hotkey `⌘ + \` to open the node type selection menu
3. Choose your node type

_Turn text into a node from the right click menu_

1. Highlight the text that you want to turn into a node
2. Right-click on the highlighted text and navigate to the menu option "Turn into Discourse Node"
3. Choose your node type

_Create Discourse Node command_

1. Search for and select "Create Discourse Node" from the command palette
2. In the node creation dialog, choose your node type and the title of your new node then click confirm
3. Your new node is created and a link to it is added to the location of your cursor

### Creating relations

To create a relation between nodes:

1. Open the page of the node that you want to create the relation for
2. Run the command "Toggle Discourse Context" which will open a widget in the right sidebar
3. From there, click `Add new relation`, choose the desired relation type and the node to link with, then click `Confirm`
4. The relation is now created and can be viewed or removed from this Discourse Context panel

## On a canvas

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/48a3a4ae-ac47-4f8b-8288-1d1ba3377ef2">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/6234a38f-be4e-4a83-bfe6-2d22ea1293e1">
  <img alt="Shows project promo image in light and dark mode">
</picture>

The Discourse Graphs plugin uses [tldraw](https://tldraw.dev/) to create canvases in Obsidian. To create a new canvas, run the command "Create new Discourse Graph Canvas".

### Creating nodes

1. Click on the Discourse Graphs icon-button located in the bottom toolbar of the canvas
2. Drag the desired node type from the menu that appears in the top-right corner of the interface onto the canvas
3. Search for or create a new node with the input field in the node creation modal
4. Click `Confirm` to add this node to the canvas

### Creating relations

1. Click on the Discourse Graphs icon-button located in the bottom toolbar of the canvas to show a menu in the top right of the interface
2. From the menu, select the desired relation type that you would like to draw between nodes
3. With the relation type selected, click and drag from one node card to another to create a relation between those nodes

# Commands

| Name                                  | Description                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Bulk identify discourse nodes         | Scan vault to identify notes that follow the pattern to be a node                          |
| Create discourse Node                 | Opens the node creation dialog modal                                                       |
| Create new Discourse Graph canvas     | Creates a tldraw canvas                                                                    |
| Open Discourse Graphs settings        | Takes you to the plugin settings menu                                                      |
| Open node type menu                   | Opens menu that allows you to choose the node type that you wish to apply to selected text |
| Switch to Discourse Graph canvas view | Renders tldraw canvas if markdown is displayed                                             |
| Switch to discourse markdown edit     | Displays markdown of a rendered tldraw canvas                                              |
| Toggle Discourse Context              | Opens a widget in the sidebar which displays relations of the active node                  |

# Get involved

1. Join our growing community of academics, researchers, and thinkers on [Slack 💬](https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg)
2. Are you a lab or researcher interested in piloting the plugin with some guidance from the team? Send us [an email](mailto:discoursegraphs@homeworld.bio) or DM on Slack!
3. Discourse Graphs is [open source](https://en.wikipedia.org/wiki/Open_source) and open to contributions. If you have an idea for an improvement or identify a bug open an issue here on the repo to start the conversation.
