---
title: "Tagging candidate nodes"
date: "2025-09-16"
author: ""
published: true
---

## Purpose - quickly bookmark notes that could later become formal discourse nodes

While you're taking notes, often you'll write down something that could later become a formal discourse node like a Claim, Evidence, or Result. But sometimes you don't want to break your flow to formalize it in the moment, or you may want to clarify/revisit it later to be sure that you want to turn it into a Claim/Evidence/Result.
It's helpful to quickly tag these. Later, you can search for them and formalize them in one click.

## Setup - define candidate nodes

In the discourse graphs settings, for each node type, list a "candidate node" tag label:

![Tagging candidate nodes demo](/docs/roam/tagging-config.gif)

⚠️ _Important: A tag cannot use text that is already part of its associated node's format. For example, if the "Claim" node format is CLM, you cannot use #CLM as its tag. You'll get an error message if you attempt to do this._

## Tag candidate nodes

Tag candidate nodes with the keyboard shortcut: `\`

![Tagging candidate nodes keyboard shortcut](/docs/roam/tagging-demo.gif)

Click or use the down arrow key to select a candidate node type.

💡 _If you've customized the keyboard shortcut for creating nodes, this keyboard shortcut will change too_

## Formalize candidate nodes

Hover your mouse over the node tag, and click "Create Evidence"

<!-- TODO: update this gif with smoother UX, including auto-remove tag -->

![Formalizing candidate nodes](/docs/roam/tagging-formalization.gif)

## Candidate node styling

Candidate node styling is currently controlled in roam/css. You can borrow our node styling here: [template-lab CSS page](https://roamresearch.com/#/app/template-lab/page/X8V4gy32s)
