---
title: "Creating Discourse Nodes"
date: "2025-01-01"
author: ""
published: true
---

The extension makes it easy to factor parts of your notes into formal of a discourse graph (claims, evidence, etc.).

Simply select the text you want to turn into a formal discourse graph node (e.g., QUE, CLM, EVD), then press hotkey (default is `\`, but you can edit this in the extension config page) to open up the refactor menu, and press appropriate shortcut key (e.g., E for evidence); system will create new page with the text as title and appropriate metadata and boilerplate sections.

Demo:

You can customize templates for nodes in the config page for the node. It is in the name space `discourse-graph/nodes/NameOfNode`. For example, here is the config page for the stock evidence node, and its template:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FVtjFJyQV46XaLExTCoU9%252FCleanShot%25202022-03-09%2520at%252023.40.33.png%3Falt%3Dmedia%26token%3D51697e02-3334-4661-9cec-5c2ab50dd1ac&width=300&dpr=4&quality=100&sign=a6b14d76&sv=2)
