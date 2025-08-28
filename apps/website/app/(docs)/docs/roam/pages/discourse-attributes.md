---
title: "Discourse Attributes"
date: "2025-01-01"
author: ""
published: true
---

- [Discourse Context](./discourse-context)
- [Discourse Context Overlay](./discourse-context-overlay)
- [Discourse Attributes](./discourse-attributes)
- [Node Index](./node-index)

## Define Discourse Attributes

You can define discourse attributes that for each discourse node, which compute a numerical "score" for each instance of the node based on its discourse relations to other nodes. In the extension, we call these **discourse attributes**.

These attributes can be handy for sorting/querying nodes. For instance, if you create a discourse attribute for Claim nodes that is a function of the number of Evidence nodes that Support the Claim, like this:

![](/docs/roam/settings-discourse-attributes.png)

You can add discourse attributes as a column to display and sort/filter by when [Querying your discourse graph](./querying-discourse-graph.md) by adding a `discourse:{label}` selection.

For example, in the index for Claims, you can return the Evidence attribute as a column (Select), and then sort in descending order by that attribute.

## Basic Discourse Relation Functions

A discourse attribute consists of one or more **discourse functions**, joined by one or more math operations. You can think of the discourse functions as variables that get their value from some discourse relations the node participates in.

Here is the template for each discourse function: `{count:relationName:targetType}`

- `count` is the operation. Atm, this is the only supported operation for basic discourse functions. We also have experimental discourse functions that operate over the discourse attributes of related nodes (see below), which allow for other operations such as `sum` and `average`
- `relationName` is the name of the relation you want to use for the function, such as `Supported By` or `Informed By`
- `targetType` is the name of the type of target of the relation you want to use for the function (since nodes can have relationships of the same name with multiple other nodes, such as `Supported By:Claim` or `Supported By:Evidence`)

Here are some examples:

- `{count:Supported By:Evidence}`
- `{count:Informed By:Source}`
- `{count:Opposed By:Claim}`

You can use basic math operations to combine multiple discourse functions. For example, you might want to combine information across the supporting and opposing relationships to gauge how "robust" a Claim is, and give different weights to support from evidence vs. claims. You could express it like this:

`{count:Supported By:Evidence} + {count:Supported By:Claim}*0.5 - {count:Opposed By:Evidence} - {count:Opposed By:Claim}*0.5`

This function sums up the number of supporting relations and subtracts the number of opposing relations, but gives only half weight (`*0.5`) to supporting/opposing relations from Claims.

## Compound Discourse Functions

We have an experimental feature that allows us to access discourse attributes from related nodes to compute a discourse attribute. This allows us to experiment with more sophisticated ways to reason over our discourse nodes.

For example, if a Claim that only gets direct support from other Claims (e.g., because it is quite general), we might care to distinguish if its supporting Claims are themselves also supported by Evidence.

If each Claim node has a discourse attribute called Evidence that looks like this:

`{count:Supported By:Evidence} - {count:Opposed By:Evidence}`

We can define a compound discourse function that _averages_ over the Evidence attribute of Claims that support the Claim. Like this:

`{average:Supported By:Claim:Evidence}`

The syntax for these compound discourse functions is:

`{operation:relationName:targetType:targetDiscourseAttribute}`

This generalizes the syntax for the basic discourse functions by adding a discourse attribute to access from the targets, and the option of using additional operations than `count` (for now, we only support `sum` and `average`) for the function.
