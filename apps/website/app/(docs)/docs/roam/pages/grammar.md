---
title: "Extension grammar"
date: "2025-01-01"
author: ""
published: true
---

- [Nodes](./nodes)
- [Operators and relations](./operators-relations)
- [Relations patterns](./relations-patterns)
- [Base grammar](./base-grammar)

The basic technical intuition behind the extension is that it creates a mapping between the following two elements:

- **Human-readable, natural writing patterns in Roam** such as pages, blocks, page/block references, and indentation
- **Discourse graph nodes and relations** such as questions, claims, evidence, and relations like support/oppose/inform

This works because writing in Roam is instantiated as transactions on an underlying [Datomic](https://docs.datomic.com/cloud/whatis/data-model.html) database, queryable via [the Datomic dialect of Datalog](http://www.learndatalogtoday.org/). At it's most basic level, the extension's discourse graph grammar is defined in terms of higher-order combinations of Datalog queries.

The purpose of this mapping is to make it possible to write and outline as naturally as possible, to help your own thinking, and then have the extension [recognize](./creating-discourse-relationships) (and "make real") the important relationships in your thinking that you have specified, so you and others can build on it in the near or later future as you continue your work.

For this reason, if you want to better understand how the extension works, and especially if you want to [extend or customize its grammar](./extending-personalizing-graph), it is very useful to get a robust intuition for how Datomic and Datalog work.

Here are two helpful entry points for this:

- [https://www.zsolt.blog/2021/01/Roam-Data-Structure-Query.html](https://www.zsolt.blog/2021/01/Roam-Data-Structure-Query.html)
- [http://www.learndatalogtoday.org/](http://www.learndatalogtoday.org/)

## Relation grammar building blocks

[Nodes](./nodes)
