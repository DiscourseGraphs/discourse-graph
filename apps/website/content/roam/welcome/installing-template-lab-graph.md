---
title: "Batteries included: downloading and installing the template lab graph"
date: "2026-08-27"
author: ""
published: true
---

The discourse graph team maintains an [example Roam Research graph](https://roamresearch.com/#/app/template-lab/page/ynSbRDCOC) that comes pre-built with templates, queries, and SmartBlocks for common graph functions, as well as tutorials explaining these functions.

The graph is designed to support multiple users in a collaborative lab group setting but also accommodates single users. Features include:

1. Daily Notes Page templates
2. Project & Experiment page templates
3. A small set of predefined nodes & relations
4. Smartblocks to create discourse canvases linked to project and question pages
5. A journal club page
6. Examples of the major node types
7. A set of tutorials explaining workflows and advanced functions

## Installing the template lab graph

1. Create a Roam Research account, if you don't have one already (Roam Research is a paid subscription software). Create an empty Roam Research graph.

2. Navigate to the [template lab page](https://roamresearch.com/#/app/template-lab/page/ynSbRDCOC)

![template lab graph welcome page](/docs/roam/template-lab-welcome.png)

3. Open the (`...`) menu, select, "Export All" and then choose the EDN export format.

![export menu](/docs/roam/template-lab-export01.png)
_The `...` menu_

![edn export](/docs/roam/template-lab-export02.png)
_Select the msgpack format_

4. In your empty graph, navigate to _Settings_ and select _Data & Backups_.

![Data and Backups](/docs/roam/template-lab-restore01.png)
_Restoring a graph from backup_

5. Select _Restore this graph_ - you will be prompted to upload your msgpack backup and restore your graph.

![restore graph](/docs/roam/template-lab-restore02.png)
_Be not afraid_

Your graph may appear empty at first but if you open _All Pages_ in the sidebar you should see the imported content. Now it's time to install the plugin(s).

1. Open _Roam Depot_ from the _Settings_ Menu. Browse the _Community Extensions_

2. Install and enable the **Discourse Graph** and **SmartBlock** extensions.You may also find the **Breadcrumbs** and **Color Highlighter** extension useful.

![plugins](/docs/roam/template-lab-ext.png)
_Extensions screen_

3. Reload your browser window. Your graph should"come alive" with discourse graph content and a left sidebar populated with default links.

![empty graph](/docs/roam/template-lab-test01.png)
_Boo ..._

![plugin enabled](/docs/roam/template-lab-test02.png)
_Yay!_

N.B. The template graph is updated regularly, but once you export the graph, your version is frozen -- check our [Slack channel](https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg) for updates you can copy to your graph.
