---
title: "Querying Discourse Graph"
date: "2025-01-01"
author: ""
published: true
---

**Note: a lot of the querying functionality overlaps with the RoamJS query-builder extension, which was spun off from this extension. You might find the documentation for the query-builder helpful for learning how to run queries:** [**https://roamjs.com/extensions/query-builder**](https://roamjs.com/extensions/query-builder)

The query drawer component allows you to construct structured queries over your discourse graph, based on discourse relations (e.g., "find all evidence that supports/opposes a claim"), and reason over the results in a structured, tabular format (e.g., "find all evidence that supports a claim, and allow me to filter/sort by methodological details").

## Quick demo

Demo of query drawer (\*slightly\* different version from latest version, so some details of the results table are different)

## Making a query

Use Command Palette (⌘+`P` on Mac,`CTRL`\+ `P` otherwise) to access the query drawer.

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FucIbbRPFNErjWmvUWsuT%252FCleanShot%25202022-04-01%2520at%252021.40.17.png%3Falt%3Dmedia%26token%3D2081a074-7427-4f64-b16c-4698a7eb9d6b&width=768&dpr=4&quality=100&sign=359890e5&sv=2)

A query drawer component will open from the left. From there, you can construct structured queries of your discourse graph and explore their results in a tabular format.

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252F0ftjk5RTY8KpVYbns7rr%252FCleanShot%25202022-04-01%2520at%252021.41.02%25402x.png%3Falt%3Dmedia%26token%3D2ae6c4a2-17bd-4462-a9ae-bf8ff92f5e14&width=768&dpr=4&quality=100&sign=7f5d3bfc&sv=2)

## Some common queries

### Find all evidence that informs a question

Example query:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FMWPf303ozAs41sTKodVa%252FCleanShot%25202022-04-01%2520at%252023.47.35%25402x.png%3Falt%3Dmedia%26token%3Dec9f20f3-e52d-449a-80e7-89fd7df4b1d9&width=768&dpr=4&quality=100&sign=ce3c3b67&sv=2)

The results:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FyIqwgNmXBxP3aAo25S27%252FCleanShot%25202022-04-01%2520at%252023.47.58%25402x.png%3Falt%3Dmedia%26token%3Ddd3d81c0-45dd-4616-8eff-9e054c341048&width=768&dpr=4&quality=100&sign=ecdda401&sv=2)

### Find all evidence that supports a claim

Example query:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252Fw1xCMcFkXYbE1odWP9j9%252FCleanShot%25202022-04-01%2520at%252023.52.11%25402x.png%3Falt%3Dmedia%26token%3D52753a1f-6438-4a09-9843-a885416cc7f2&width=768&dpr=4&quality=100&sign=ee71f061&sv=2)

The results:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FrFnJ4GSZeVZkSfi8DDrK%252FCleanShot%25202022-04-01%2520at%252023.51.39%25402x.png%3Falt%3Dmedia%26token%3D8a060fbb-f01a-40ab-90a5-d996121df562&width=768&dpr=4&quality=100&sign=c0d223d9&sv=2)

## More advanced queries

### Mix discourse and Roam queries

Example: find all evidence that informs a question, but only if it was collected in a specific location (this example assumes at least some evidence pages have an attribute `Location::` in them)

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FPu1P09mHjDgubm8nWWpa%252FCleanShot%25202022-04-01%2520at%252023.57.43%25402x.png%3Falt%3Dmedia%26token%3D8bf2b34e-bd79-4b94-8580-18e853ca4e14&width=768&dpr=4&quality=100&sign=9038a27d&sv=2)

Results:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252F3vnWb4zgfB7NrFZ3AYep%252FCleanShot%25202022-04-01%2520at%252023.58.22%25402x.png%3Falt%3Dmedia%26token%3D89a352ad-962d-42e5-8e54-0f0bb5b2975e&width=768&dpr=4&quality=100&sign=37530e8a&sv=2)

### Select node attributes to display as attributes of results

Example: find all evidence that informs a question, and select a methods attribute to display so we can sort/filter on it (this example assumes at least some evidence pages have an attribute `testingRegime::` in them)

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252F7ERzj7j5oAMulB17cxlk%252FCleanShot%25202022-04-02%2520at%252000.01.04%25402x.png%3Falt%3Dmedia%26token%3Da2fc92ab-5b23-4edd-b5df-b2d9377fab29&width=768&dpr=4&quality=100&sign=ee53e213&sv=2)

Results (note: will display "blank" for nodes that lack values for the selected attribute):

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FPU6YbIdMzPXDfnaFej2o%252FCleanShot%25202022-04-02%2520at%252000.01.22%25402x.png%3Falt%3Dmedia%26token%3Db65b7d96-350b-47e9-8a16-4d790eda34b6&width=768&dpr=4&quality=100&sign=2e5f1335&sv=2)

### Select discourse attributes to display as attributes of results

If you have defined [Discourse attributes](https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/guides/exploring-your-discourse-graph/discourse-attributes) for the node you want to query, you can select it as a column in your query. The syntax for accessing a node's discourse attribute as a select is`discourse:discourseAttributeName`.

Example: find all claims and display their "Evidence" discourse attributes (number of supporting evidence relations) as a column.

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FUzAz2CnYbSbci32YaBHA%252FCleanShot%25202022-08-10%2520at%252009.33.43%25402x.png%3Falt%3Dmedia%26token%3D05d362c1-6552-4b3d-9ab6-d1f8bf18db99&width=768&dpr=4&quality=100&sign=778f57f7&sv=2)

Results:

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FzIeU4A2XkolPEFvMfacU%252FCleanShot%25202022-08-10%2520at%252009.34.36%25402x.png%3Falt%3Dmedia%26token%3Dc5207e94-958d-4418-8d86-a0bcc0097a06&width=768&dpr=4&quality=100&sign=9009f1e5&sv=2)

## Sorting/filtering a query's results

You can filter and sort each column in the results table.

## Naming a query

You can name a query if you like!

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FEoHEpmInyUdsPgSm3bxE%252Frename-query.gif%3Falt%3Dmedia%26token%3Db28406d0-2bc7-456e-a220-cfd644903874&width=768&dpr=4&quality=100&sign=9e54fc7a&sv=2)

## Saving a query to its own page

You can save a query to its own page if you want to keep it around for easier access.

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252F45Ncnv88iwpyAGPXnFbl%252FCleanShot%25202022-04-02%2520at%252000.14.15%25402x.png%3Falt%3Dmedia%26token%3D9fc84685-d724-4c87-92c5-7e2810ccf66a&width=300&dpr=4&quality=100&sign=2d2a2f45&sv=2)

It will be saved to the namespace `discourse-graph/queries/`

![](https://oasis-lab.gitbook.io/~gitbook/image?url=https%3A%2F%2F3894211722-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FVpoqQNZpk4qG2nMcQUaw%252Fuploads%252FIMylaMmqdnLkkD0BKC93%252FCleanShot%25202022-04-02%2520at%252000.16.26%25402x.png%3Falt%3Dmedia%26token%3D52119802-c613-419b-8f1f-de5896d08f29&width=768&dpr=4&quality=100&sign=5d13a33a&sv=2)
