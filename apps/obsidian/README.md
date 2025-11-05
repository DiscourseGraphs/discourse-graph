<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/1a448567-c799-489e-bdc4-e708c280b18e">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/3abbf462-d6dc-4e8f-b40a-d668d250d424">
  <img alt="Shows project promo image in light and dark mode">
</picture>

# Discourse Graphs for Obsidian

The Discourse Graph extension enables Obsidian users to seamlessly add additional semantic structure to their notes, including specified page types and link types that model scientific discourse, to enable more complex and structured knowledge synthesis work, such as a complex interdisciplinary literature review, and enhanced collaboration with others on this work.

For more information about Discourse Graphs, check out our website at [https://discoursegraphs.com](https://discoursegraphs.com)

## Installation

### Prerequisites

#### Install BRAT (Beta Reviewer's Auto-update Tester)

1. Open Obsidian Settings
2. Go to Community Plugins and disable Restricted Mode
3. Click "Browse" and search for "BRAT"
![BRAT](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2Faar5LKpLOk.png?alt=media&token=6f51ac48-19d3-4bb5-9a07-7b32cfa6afe6)
4. Install BRAT and enable it

#### Install DataCore via BRAT

1. Open Obsidian Settings
2. Go to "Community Plugins" → "BRAT"
3. Click "Add Beta Plugin"
![Add plugin](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FdMtstUHPXe.png?alt=media&token=3f139ab9-9802-404d-9554-4a63bac080c5)
4. Enter the repository URL: `https://github.com/blacksmithgu/datacore` and choose "Latest version"
![Add datacore](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FEY3vNGt1Rf.png?alt=media&token=32c60ff1-5272-4cde-8b5f-8f049fb2cf50)
5. Check the box for "Enable after installing the plugin"
6. Click "Add plugin"

### Install Discourse Graphs

1. Open Obsidian Settings
2. Go to "Community Plugins" → "BRAT"
3. Click "Add Beta Plugin"
![Add plugin](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FdMtstUHPXe.png?alt=media&token=3f139ab9-9802-404d-9554-4a63bac080c5)

4. Enter the repository URL: `https://github.com/DiscourseGraphs/discourse-graph-obsidian`  and choose "Latest version"
![Add discourse graph](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FSBCK-2lkcu.png?alt=media&token=0375c828-da4d-43b4-8f2c-e691692cb019)
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
   - **Template (Optional)**: Select a template from the dropdown to automatically apply template content when creating nodes of this type
     - Templates are sourced from Obsidian's core Templates plugin
     - Ensure you have the Templates plugin enabled and configured with a template folder
     - The dropdown will show all available template files from your configured template folder

      ![add node types with template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FHMg_Tq6qiR.png?alt=media&token=69828bfc-c939-41b0-abd4-2cc8931c5a38)
     - Click "Save Changes"

    
- To create a new template:
  + Create new folder to store templates
  ![new folder](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FyTtJ1a0iI2.png?alt=media&token=b5d09b10-f170-47cd-a239-ee5f7acd89dc)

  + Specify template folder location in plugin settings menu
  ![template](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FhzZg_GJXY9.png?alt=media&token=508c8d19-1f13-4fb3-adf1-898dcf694f08)

  + Create new file in template folder (A) and add text to file (B)
  ![create template file](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FtTr9vOnXnX.png?alt=media&token=dda1fe25-3ccf-42b4-8f3c-1cd29f82c3f7)

  ![add node types](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FYRZ6ocI_d-.png?alt=media&token=c623bec7-02bd-42b4-a994-cd1c40a54d82)
  - Click "Save Changes"
#### Edit Relation Types
   - Under "Relation Types," click "Add Relationship Type"
   - A relation type is a kind of relationship that can exist between any two node types
   - Enter a name for your relationship (e.g., "supports", "contradicts")
   - Enter the complement label (e.g., "is supported by", "is contradicted by")
   ![add relation type](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2Fjk367dcO_K.png?alt=media&token=22d74e9f-882c-434b-8b50-afd7a754fb2b)
   - Click "Save Changes"
#### Define possible relations between nodes
- Open the Discourse Relations tab in the Discourse Graph settings
![discourse relation](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FNgm7Ha4Ul5.png?alt=media&token=a933bd3a-d9a6-42c1-9c6e-d779d41c7ebf)
- Choose Source Node Type, Relation Type, and Target Node Type
![choose relation](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FlflJBkfdaK.png?alt=media&token=5de9617c-6099-46e8-931f-feafc604cabb)
- Once you see the source, relation, and target selected:
![final relations](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FycPW-N-rY8.png?alt=media&token=54867be2-9030-4c6c-82d2-b96069e52d81)
E.g: this means that *Claim* nodes can supports *Questions* nodes
- Click "Save changes"

## Using Discourse Graphs

### Instantiate a Node

- Select the text you want to turn into a Discourse Node
![select text](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FInIer-iPGs.png?alt=media&token=fad214f6-f426-4249-8b0a-d5a403894600)
- There are two ways you can create a node from here:
  
  1. Using command keys: Cmd + \ 
  <br>
  - As you press these keys, the Node Menu will open up as a popup
  
  ![node menu](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FS6eU6y70eX.png?alt=media&token=00e61ddf-877b-4752-a65b-272e80a0a19c)
  - Select the node type you want to turn the text into
  - Voila, you've created a new discourse node
  ![node created](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F1VNkJC0aH8.png?alt=media&token=df9a26aa-997b-4b56-a307-87a80e350b28)
  
  2. Right-click menu:
  - Alternatively, you can right-click on the selected text
  ![right click menu](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F4UqeVkqLz7.png?alt=media&token=d2373152-d251-45fe-afb6-56373d6092aa)
  - Then choose a node type from the "Turn into Discourse Node" menu

### Open Discourse Context

-  Click on the telescope icon on the left bar
![open discourse context](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FE10krHZcDM.png?alt=media&token=c1796a9f-7e51-437f-913d-91f5433d9bab)
- Alternatively, you can set a hotkey to toggle the Discourse Context view or access it via the Command Palette
![command palette](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F5ybScaQISO.png?alt=media&token=2b36f0e7-4247-47b7-a53d-c784dfd4609b)

### Instantiate a Relationship

1. Open a note that you want to create a relationship from
2. Open the Discourse Context
![open discourse context](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FE10krHZcDM.png?alt=media&token=c1796a9f-7e51-437f-913d-91f5433d9bab)
3. Click "Add a new relation"
4. The dropdown that shows Relationship Types will be all available relations that you have defined in the setings.
<br> It will also show you what node type you can link with
![add relation](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FXQsgznWuV2.png?alt=media&token=9442b9fa-0904-4847-8eb8-a5791705c4c5)
5. Search the nodes you want to link with by the title
![search](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2F4NW4UjYDrC.png?alt=media&token=bae307d0-ebec-4e6b-a03d-0943d9d03754)
6. Click "Confirm", now a new relationship has been created
![relationship created](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fdiscourse-graphs%2FK8XAhCqrUL.png?alt=media&token=a559c477-c7f6-4b3e-8b00-ece7da5d4fec)
