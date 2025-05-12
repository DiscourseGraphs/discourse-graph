# Discourse Graphs for Obsidian

The Discourse Graph extension enables Obsidian users to seamlessly add additional semantic structure to their notes, including specified page types and link types that model scientific discourse, to enable more complex and structured knowledge synthesis work, such as a complex interdisciplinary literature review, and enhanced collaboration with others on this work.

For more information about Discourse Graphs, check out our website at [https://discoursegraphs.com](https://discoursegraphs.com)

## Installation

### Prerequisites

#### Install BRAT (Beta Reviewer's Auto-update Tester)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Restricted Mode
3. Click "Browse" and search for "BRAT"
![BRAT](/apps/obsidian/docs/media/BRAT.png)
4. Install BRAT and enable it


#### Install DataCore via BRAT

1. Open Obsidian Settings
2. Go to "Community Plugins" → "BRAT"
3. Click "Add Beta Plugin"
![Add plugin](/apps/obsidian/docs/media/add-beta-plugin.png)
4. Enter the repository URL: `https://github.com/blacksmithgu/datacore` and choose "Latest version"
![Add datacore](/apps/obsidian/docs/media/add-datacore.png)
5. Check the box for "Enable after installing the plugin"
6. Click "Add plugin"

### Install Discourse Graphs

1. Open Obsidian Settings
2. Go to "Community Plugins" → "BRAT"
3. Click "Add Beta Plugin"
![Add plugin](/apps/obsidian/docs/media/add-beta-plugin.png)

4. Enter the repository URL: `https://github.com/DiscourseGraphs/discourse-graph-obsidian`  and choose "Latest version"
![Add discourse graph](/apps/obsidian/docs/media/add-discourse-graph.png)
5. Check the box for "Enable after installing the plugin"
6. Click "Add Plugin"


## Creating Nodes and Relationships

### Configure Node and Relationship Types

1. Open Obsidian Settings
2. Navigate to the "Discourse Graphs" settings tab
#### Edit Node Types
   - Under "Node Types," click "Add Node Type"
   - Enter a name for your node type (e.g., "Claim", "Evidence", "Question")
   - Add the format for your node type. eg a claim node will have page title "CLM - {content}"
  ![add node types](/apps/obsidian/docs/media/add-node-types.png)
  - Click "Save Changes"
#### Edit Relation Types
   - Under "Relation Types," click "Add Relationship Type"
   - A relation type is a kind of relationship that can exist between any two node types
   - Enter a name for your relationship (e.g., "supports", "contradicts")
   - Enter the complement label (e.g., "is supported by", "is contradicted by")
   ![add relation type](/apps/obsidian/docs/media/relation-types.png)
   - Click "Save Changes"
#### Define possible relations between nodes
- Open the Discourse Relations tab in the Discourse Graph settings
![discourse relation](/apps/obsidian/docs/media/discourse-relations.png)
- Choose Source Node Type, Relation Type, and Target Node Type
![choose relation](/apps/obsidian/docs/media/choose-discourse-relations.png)
- Once you see the source, relation, and target selected:
![final relations](/apps/obsidian/docs/media/final-relation.png)
E.g: this means that *Claim* nodes can supports *Questions* nodes
<br/>
- Click "Save changes"

## Using Discourse Graphs

### Instantiate a Node

- Select the text you want to turn into a Discourse Node
![select text](/apps/obsidian/docs/media/select.png)
- There are two ways you can create a node from here:
  
  1. Using command keys: Cmd + \ 
  <br>
  - As you press these keys, the Node Menu will open up as a popup
  
  ![node menu](/apps/obsidian/docs/media/node-menu.png)
  - Select the node type you want to turn the text into
  - Voila, you've created a new discourse node
  ![node created](/apps/obsidian/docs/media/node-created.png)
  
  2. Right-click menu:
  - Alternatively, you can right-click on the selected text
  ![right click menu](/apps/obsidian/docs/media/right-click-menu.png)
  - Then choose a node type from the "Turn into Discourse Node" menu

### Open Discourse Context

-  Click on the telescope icon on the left bar
![open discourse context](/apps/obsidian/docs/media/open-dg-context.png)
- Alternatively, you can set a hotkey to toggle the Discourse Context view or access it via the Command Palette
![command palette](/apps/obsidian/docs/media/command.png)

### Instantiate a Relationship

1. Open a note that you want to create a relationship from
2. Open the Discourse Context
![open discourse context](/apps/obsidian/docs/media/open-dg-context.png)
3. Click "Add a new relation"
4. The dropdown that shows Relationship Types will be all available relations that you have defined in the setings.
<br> It will also show you what node type you can link with
![add relation](/apps/obsidian/docs/media/add-relationship.png)
5. Search the nodes you want to link with by the title
![search](/apps/obsidian/docs/media/search.png)
6. Click "Confirm", now a new relationship has been created
![relationship created](/apps/obsidian/docs/media/relationship-created.png)