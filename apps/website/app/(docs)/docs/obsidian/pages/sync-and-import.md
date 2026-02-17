---
title: "Sync and Import"
date: "2026-02-16"
author: ""
published: true
---

The Sync and Import feature allows you to synchronize your discourse nodes with the Discourse Graph database and share them with collaborators. Once enabled, you can publish nodes to a shared group space and import nodes published by others.

> **Note:** This feature is currently in **beta**. The sync functionality requires an active connection to the Discourse Graph database.

## Enabling Sync Mode

### Step 1: Open Settings

Open the Discourse Graph plugin settings:

1. Open **Obsidian Settings** (click the gear icon in the bottom-left corner, or press `Cmd/Ctrl + ,`)
2. Scroll down in the left sidebar to **Community Plugins**
3. Find **Discourse Graph**

### Step 2: Reveal the Admin Panel

The sync feature is located in a hidden **Admin Panel** tab that is not visible by default.

1. While on the Discourse Graph settings page, press `Cmd + Shift + A` (Mac) or `Ctrl + Shift + A` (Windows/Linux)
2. A new **Admin Panel** tab will appear in the settings tab bar

![Admin Panel tab revealed](/docs/obsidian/sync-setting.png)

### Step 3: Enable Sync Mode

1. In the **Admin Panel** tab, find the **(BETA) Sync mode enable** toggle
2. Click the toggle to enable sync mode
3. Click **Save Changes**
4. A confirmation notice will appear: "Admin panel settings saved"
5. The sync mode will initialize automatically, and you will see a notice: "Sync mode initialized successfully"

Once enabled, your discourse nodes will begin syncing automatically to the Discourse Graph database. The plugin monitors file changes in your vault (with a short delay) and syncs them in the background.

---

## Publishing a Discourse Node

Publishing makes a synced discourse node available to other members of your group. This is how you share your work with collaborators.

### Prerequisites

Before publishing, make sure:

- **Sync mode is enabled** (see above)
- **You are a member of a group.** Group membership is managed by your team administrator. The Discourse Graph team will ensure you are added to the appropriate group before you can publish.
- The discourse node you want to publish has a `nodeTypeId` in its frontmatter
- The discourse node has been **synced at least once** (it must have a `nodeInstanceId` in its frontmatter — this is assigned automatically after the first sync)

### Steps to Publish

1. **Open the discourse node** you want to publish in the editor

2. **Open the Command Palette** by pressing `Cmd/Ctrl + P`

3. **Search for the publish command** by typing "Publish" and select **"Discourse Graph: Publish current node to lab space"**
![Publish command in palette](/docs/obsidian/publish-command.png)

4. The plugin will:
   - Publish the node to your group
   - Sync any embedded assets (images, attachments) to the shared storage
   - Update the node's frontmatter with a `publishedToGroups` field

5. A confirmation notice will appear: **"Published"**
![Node published successfully](/docs/obsidian/publish-success.png)

> **Tip:** If you see the message "Please sync the node first", wait a moment for the automatic sync to complete, or manually trigger a sync via the Command Palette using **"Discourse Graph: Sync discourse nodes to Supabase"**.
![Sync command](/docs/obsidian/sync-command.png)
---

## Importing Discourse Nodes from Another Space

Importing allows you to bring published discourse nodes from other group members into your vault.

### Steps to Import

1. **Open the Command Palette** by pressing `Cmd/Ctrl + P`

2. **Search for the import command** by typing "Import" and select **"Discourse Graph: Import nodes from another space"**

![Import command in palette](/docs/obsidian/import-command.png)

3. The **Import Nodes** modal will open and begin loading available nodes from your groups. Once loaded, you will see a list of importable nodes **grouped by space**. Each space section shows the space name and available nodes.

![Selecting nodes to import](/docs/obsidian/import-modal.png)

4. The plugin will import each selected node and display a progress bar. Once complete, a confirmation notice will appear showing how many nodes were imported successfully.

Imported nodes are saved in an `import/{spaceName}/` folder in your vault, preserving the original space organization.

![Import location](/docs/obsidian/import-location.png)

---

## Refreshing Imported Nodes

After importing, you can fetch the latest content from the original sources to keep your imported nodes up to date.

1. **Open the Command Palette** by pressing `Cmd/Ctrl + P`
2. Search for "Fetch" and select **"Discourse Graph: Fetch latest content from imported nodes"**
3. The plugin will check each imported node for updates and refresh any that have changed

![Refreshing imported nodes](/docs/obsidian/refresh-imported.png)

Alternatively, you can click "Refresh" button from the Discourse Context panel.

![Refresh button](/docs/obsidian/refresh-button.png)
---

## Summary of Commands

- **Sync discourse nodes to Supabase**:  Manually sync all discourse nodes to the database
- **Publish current node to lab space**: Publish the active discourse node to your group            
- **Import nodes from another space**:Open the import modal to browse and import shared nodes    
- **Fetch latest content from imported nodes**: Refresh all imported nodes with the latest content         


## Troubleshooting

- **"Sync mode is not enabled"** — You need to enable sync mode in the Admin Panel first (see [Enabling Sync Mode](#enabling-sync-mode) above)
- **"Please sync the node first"** — The node hasn't been synced yet. Wait for automatic sync or trigger a manual sync
- **"You are not a member of any groups"** — You need to be added to a group before you can import nodes. Contact your team administrator
- **No importable nodes found** — Either no nodes have been published to your groups, or you have already imported all available nodes
