---
title: "Share your ideas & research"
date: "2026-06-29"
author: ""
published: true
---

You've built your graph, it's a work of beauty and insight -- now you're ready to share what you've learned.

![sharing your graph](/docs/guides/obsidian/dgraph-share.png)
_Getting eyes on the prize_

- [Share individual nodes](#sharing-your-discourse-nodes)
- [Share your canvas](#sharing-your-discourse-canvas)
- [Use your graph as a springboard for drafting a manuscript](#drafting-a-manuscript-from-your-discourse-graph)

## Sharing your discourse nodes

We've just added a feature to allow you to share "live" nodes with your collaborators by publishing them to a shared group space: The **sync and import** feature, currently hidden behind an admin panel.

![](/docs/guides/obsidian/backrooms.jpg)
_Opening the admin panel_

> [!info] For further information on the sync mode feature, visit [the website docs](/docs/obsidian/advanced-features/sync-and-import). To request access, please email discoursegraphs@gmail.com

## Sharing your discourse canvas

### Presenting your Canvas

Your [canvas](/docs/obsidian/core-features/canvas) can be used to give a PowerPoint- or Figma-like visual overview of your work.

You can start at your motivating Question and move through your hypothesis to your experiments and their results, opening each node in the sidebar to show your audience relevant details.

![canvas walkthrough](/docs/guides/obsidian/canvas-walkthru01.gif)
_Example Canvas walkthrough_

You can create a "presentation view" for your discourse nodes by adding the material/images you wish to highlight at the top of the page -- the first image on the page is automatically selected as the image that displays on the discourse canvas.

> [!tip] You can [modify your discourse templates](/docs/obsidian/configuration/node-types-templates) to customize your presentation view.

### Exporting your Canvas

You can export a static .png or .svg image of your discourse canvas from the menu.

![export a png or svg](/docs/guides/obsidian/canvas-export%201.png)
_Canvas export menu_

> [!note] It is not possible at present to export a "live" discourse canvas to another graph.

## Drafting a manuscript from your discourse graph

### Using the canvas as a storyboard

You can use the discourse canvas to organize your ideas for a paper. Your canvas allows you to follow your train of thought from hypothesis formation to hypothesis testing -- including the dead ends. You can see at a glance which sources (references) were crucial to the formulation of certain claims, and which informed the design of your experiments.

If you are targeting a particular journal, you might find it helpful to spatially arrange your discourse nodes according to their ms submission format. This can give you a head start on the drafting stage.

![](/docs/guides/obsidian/ms-canvas.png)
_Using canvas layers to organize article sections_

The Canvas layout can also be used to spot "gaps" in your argument at a glance, before Reviewer #2 rushes in to fill them with part of their œuvre.

![](/docs/guides/obsidian/gap-spotting.png)
_Spotting unsupported Claims before Reviewer #2_

The Canvas is also useful for designing figure panels.

### Arguing with your graph

Your discourse nodes should be formulated as concisely as possible (remember node = filename). But the rest of the page can be used to construct and elaborate your broader point. The example below links both **Evidence** and **Caveats** related to a **Claim**. In this discourse context, a _Caveat_ is an observation that weakens the claim without necessarily opposing it. Some caveats may be promoted to Evidence that _opposes_ a Claim after further investigation, others may become **Issues**: requests for additional analyses to clarify a point. Anticipating the most salient caveats to each of your claims is a useful preparation for the review stage of your ms submission.

![](/docs/guides/obsidian/graph-argument.png)
_An example of a claim with caveats_

You can [modify your discourse graph templates](/docs/obsidian/configuration/node-types-templates) to structure key information in a way that facilitates article writing later.

![](/docs/guides/obsidian/graph-argument-evd.png)
_An example of an Evidence node with methods context_

Discourse nodes are modular and composable and can be re-used in multiple projects. One strategy to maximize composability is to capture "evergreen" information in the node template and add additional project-specific context in the "log" section.

![](/docs/guides/obsidian/node-log.png)
_In the [Obsidian example vault](https://github.com/DiscourseGraphs/obsidian-lab-example) CLM, HYP, ISS, EXP, & QUE node templates have a "log" section_

## Exporting your graph

Your discourse nodes are markdown notes, and they can be copied, printed, & exported in different formats.

While the **Discourse Node Sync** feature mentioned above is the only fully-supported way of sharing functional discourse nodes, you can get a quick-and-dirty approximation using copy/paste. Importing a "foreign" discourse node into your graph strips it of its relation data, but it can still be recognized as a discourse node if its NodeTypeId exists in your graph. Open the 3-dot menu in the file pane: if the option "Convert Into" exists, it is not recognized as a node, and you can select the type of node you'd like to turn it into.

## What else would you like to do?

- [Build and Utilize a Personal Knowledge Base](/docs/obsidian/use-cases/build-utilize-personal-knowledge-base)
- [Synthesize Insights from the Literature](/docs/obsidian/use-cases/synthesize-insights-from-literature)
- [Track your Projects and Experiments](/docs/obsidian/use-cases/track-your-projects-and-experiments)
