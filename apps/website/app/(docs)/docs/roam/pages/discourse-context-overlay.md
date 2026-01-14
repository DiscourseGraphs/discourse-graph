---
title: "Discourse context overlay"
date: "2025-01-01"
author: ""
published: true
---

- [Discourse context](./discourse-context)
- [Discourse context overlay](./discourse-context-overlay)
- [Discourse attributes](./discourse-attributes)
- [Node index](./node-index)

The discourse context overlay adds an icon next to each discourse node wherever it is referenced. This icon provides access to two key features:

1. a popover to view the [Discourse context](./discourse-context) of the node inline, and
2. a "Discourse score" component that displays a customizable score for the node that is some function of its relations to other nodes in the discourse graph.

The overlay is an optional feature that is turned off by default. To turn it on, go to the grammar tab in the config page and check the box for overlay.

![](/docs/roam/settings-discourse-context-overlay.png)

## Popover

The popover is simple to operate. Simply click on the icon to bring up the [discourse context](./discourse-context) component in-line for quick reference.

![](/docs/roam/discourse-context-overlay.gif)

## Discourse score

By default, the discourse score displays the count of the total number of discourse relations for that node (the number on the left), as well as a count of the total number of references to that node in the graph.

For example, the following score display denotes that the node participates in 5 discourse relations with other nodes, which can be seen in detail in the discourse context popover (1 informs, 1 supports, 2 consistent with, and 1 sourced by; note that 2 of these relations are [custom relations](./extending-personalizing-graph)).

![](/docs/roam/discourse-context-overlay-score.png)

You can think of this default discourse score as a rough sense of how "robust" a given node is (discourse relations are more structured, high-signal relationships) relative to how "important" it is (raw references are often noisy). If you'd like, you can also experiment with different functions of discourse relations to a node by defining your own [Discourse attributes](./discourse-attributes), and have them show up in the overlay!

## Demo

(old video demo)

https://www.loom.com/share/b3d6094cd14a466081b8aa8495eb6542
