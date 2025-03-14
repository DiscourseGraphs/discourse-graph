# Table of Contents

- [Query Blocks](#query-blocks)
- [Query Pages](#query-pages)
- [Query Drawer](#query-drawer)
- [Usage](#usage)
- [Conditions](#conditions)
- [Selections](#selections)
- [Manipulating Results](#manipulating-results)
- [Layouts](#layouts)
- [Exporting](#exporting)
- [Styling](#styling)
- [SmartBlocks Integration](#smartblocks-integration)
- [Developer API](#developer-api)
- [Examples](#examples)

# Query Builder

Query Builder can be used to create queries via a [Query Block](#query-blocks), [Query Pages](#query-pages), or the [Query Drawer](#query-drawer).

These queries are far more powerful than vanilla Roam queries, as it taps into Roam's underlying query language surfaced through an approachable UI.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FP_sZPbksxv.png?alt=media&token=c1d57c11-6bc7-4cf3-9d5f-3aa00ebaf7b1)

## Query Blocks

The above UI is available as a block component. This allows you to create several on a page, wherever on the page you want.

To create one, simply add `{{query block}}` to any block on the page or use the `Create Query Block` from the Roam Command Palette.

## Query Pages

With Query Pages, you designate certain pages in your Roam graph as "views" into your data.

On the Roam Depot Settings page for Query Builder, you should see a setting called `Query Pages`. You could use this to denote which page titles in your Roam Graph will be used to create query pages. Use the `*` as a wildcard.

By default, Query Pages is set to be titled with `queries/*`. This means any page in your graph prefixed with `queries/` can be used to save a query. You can denote multiple page title formats.

Example: `[[queries/Demo]]`

## Query Drawer

The above UI is also available as a left hand drawer, accessible from the command palette. This allows you to execute a query no matter where in your graph you are.

To open, enter `Open Query Drawer` from the Roam Command Palette.

## Usage

Create a [Query Block](#query-blocks), navigate to a [Query Page](#query-pages), or open the [Query Drawer](#query-drawer) to begin to building your query. You can use this editor to create and save a query.

There are two important parts to a query: [Conditions](#conditions) and [Selections](#selections).

After specifying conditions and selections, hit the `Query` button to return results in your graph. These results will always include a `text` field which will link to the relevant block or page reference. Hitting `Query` also effectively "Saves" the query to the graph.

The results returned will be organized in a table with sortable and filterable columns. Click on the columns to sort the data and use the filter icon to narrow down the table to your desired results:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FnI53sChRxN.png?alt=media&token=d4f5161c-fff3-4e2f-bfd1-1e4c12f6bc58)

## Conditions

**Conditions** specify which blocks you want to return. They determine the **rows** of the table. The anatomy of a Condition is a triple: `source`, `relationship`, & `target`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F479hekgysR.jpg?alt=media&token=163e97ba-c6e8-47d9-addb-e5f6bb14b81d)

You can use a combination of multiple **conditions** to select the data you want.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F5Rg4tuOgxo.png?alt=media&token=734e58e4-b71e-466b-9183-00f852c34d2a)

`relationship`s will autocomplete as you type:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FxZaDShivcN.png?alt=media&token=3e08aa10-be40-4857-85a5-bc6cd41b5aeb)

### Supported Relationships

| Relationship            | Description                                                                                                                                 | Example                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `created after`         | The `source` block or page was created after the naturally specified `target`.                                                              | [Link](examples.md#created-after)         |
| `created before`        | The `source` block or page was created before the naturally specified `target`.                                                             | [Link](examples.md#created-before)        |
| `created by`            | The `source` block or page was created by the user with a display name of `target`.                                                         | [Link](examples.md#created-by)            |
| `edited after`          | The `source` block or page was edited after the naturally specified `target`.                                                               | [Link](examples.md#edited-after)          |
| `edited before`         | The `source` block or page was edited before the naturally specified `target`.                                                              | [Link](examples.md#edited-before)         |
| `edited by`             | The `source` block or page was last edited by the user with a display name of `target`.                                                     | [Link](examples.md#edited-by)             |
| `has ancestor`          | The `source` block has the `target` block or page as an ancestor up the outliner tree.                                                      | [Link](examples.md#has-ancestor)          |
| `has attribute`         | The `source` block or page has an attribute with value `target`.                                                                            | [Link](examples.md#has-attribute)         |
| `has child`             | The `source` block or page has the `target` block as a child.                                                                               | [Link](examples.md#has-child)             |
| `has descendant`        | The `source` block or page has the `target` block as a descendant somewhere down the outliner tree.                                         | [Link](examples.md#has-descendant)        |
| `has title`             | The `source` page has the exact text `target` as a title. Supports date NLP. The `target` also supports Regular Expressions.                | [Link](examples.md#has-title)             |
| `is in page`            | The `source` block is in the `target` page.                                                                                                 | [Link](examples.md#is-in-page)            |
| `is in page with title` | The `source` block is in a page with title `target`. Supports date NLP. The `target` also supports Regular Expressions.                     | [Link](examples.md#is-in-page-with-title) |
| `is referenced by`      | The `source` block or page is referenced by the `target` block or page.                                                                     | [Link](examples.md#is-referenced-by)      |
| `references`            | The `source` block or page references the `target` block or page.                                                                           | [Link](examples.md#references)            |
| `references title`      | The `source` block or page references a page with `target` as the title. Supports date NLP. The `target` also supports Regular Expressions. | [Link](examples.md#references-title)      |
| `titled after`          | The `source` page is a DNP that is after the naturally specified `target`.                                                                  | [Link](examples.md#titled-after)          |
| `titled before`         | The `source` page is a DNP that is before the naturally specified `target`.                                                                 | [Link](examples.md#titled-before)         |
| `with text`             | The `source` block or page has the exact text `target` somewhere in its block text or page title.                                           | [Link](examples.md#with-text)             |
| `with text in title`    | The `source` page has the exact text `target` somewhere in its page title.                                                                  | [Link](examples.md#with-title-in-text)    |

### Target Options

Some relationships have a `target` field that supports the following options:

- `{date}` - matches any Daily Note Page
- `{date:today}` - matches the current date
- `{current}` - matches the page currently open in the main window
- `{this page}` - matches the page in which the query is run
- `{current user}` - matches the current user

## Selections

**Selections** specify what data from the blocks that match your conditions get returned. They determine the **columns** of the table. By default, the block text or page title is always returned and hyperlinked. Every selection is made up of two parts: the `label` and the `data`:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F_HPRxD7QLa.jpg?alt=media&token=ef75e680-3bd5-4869-8ed0-117c03b4f232)

The `label`, which gets specified after **AS**, denotes the name of the column that gets used. The `data`, which gets specified after **Select**, denotes what kind of data to return.

### Supported Data Types

**Metadata**

| Data             | Description                            | Example                            |
| ---------------- | -------------------------------------- | ---------------------------------- |
| `Author`         | The user who created the block or page | [Link](examples.md#author)         |
| `Created Date`   | The date the block or page was created | [Link](examples.md#created-date)   |
| `Created Time`   | Same as above, but in `hh:mm` format   | [Link](examples.md#created-time)   |
| `Edited Date`    | The date the block or page was edited  | [Link](examples.md#edited-date)    |
| `Edited Time`    | Same as above, but in `hh:mm` format   | [Link](examples.md#edited-time)    |
| `Last Edited By` | The user who created the block or page | [Link](examples.md#last-edited-by) |

**Additional Data Types**

| Data                               | Description                                                                                          | Example                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `{attribute}`                      | Returns the value of an `{attribute}` associated with the queried results.                           | [Link](examples.md#attribute)           |
| `node:{node}`                      | Returns any intermediary node you defined in one of the conditions.                                  | [Link](examples.md#intermediate-node)   |
| `node:{node}:{data}`               | Specify one of the metadata `{data}` options or an `{attribute}` to return for an intermediary node. | [Link](examples.md#data)                |
| `node:{node}:/regular_expression/` | Returns a match according to a regular expression between `/`'s.                                     | [Link](examples.md#regular-expression)  |
| `node`                             | Use the label to edit the column header of the first column                                          | [Link](examples.md#first-column-header) |
| `add({label1}, {label2})`          | Add the values of two columns. Supports adding values to dates.                                      | [Link](examples.md#add-or-subtract)     |
| `subtract({label1}, {label2})`     | Subtract the values betweenn two columns. Supports adding values to dates.                           | [Link](examples.md#add-or-subtract)     |

## Manipulating Results

After you fire a query, the results will output in a table view. There are multiple ways to post process these results after they output to the screen.

### Sort<!-- omit in toc -->

Clicking on the table header for a given column will trigger an alphabetical sort. Clicking again will toggle descending order. Clicking once more will toggle the sort off. You could have multiple columns selected for sorting:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FP1-KDvuRhS.png?alt=media&token=b85999f9-f9a6-4a36-acc9-bb15724507a3)

### Filter<!-- omit in toc -->

Each column is also filterable. The filter works just like the page and reference filters in native Roam, where you could pick values to include and remove:

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FG7d1TrIzNq.png?alt=media&token=8df90fc5-5e8d-4347-9721-bd067ac7616a)

### Search

Enable search by clicking on the Menu button, then Search.

This will allow you to search across all columns, case-insensitive.

https://github.com/DiscourseGraphs/discourse-graph/assets/3792666/6499147d-4d03-4767-b7e7-d1ea925697b5

### View Type<!-- omit in toc -->

Each column also has a view type. Choosing a view type will change how the cell is displayed in the table.

The supported view types are:

| View Type | Description                                           |
| --------- | ----------------------------------------------------- |
| `plain`   | Outputted as plain text                               |
| `link`    | Outputted as text that links to the block or page     |
| `embed`   | Embeds the contents of the block or page in the cell. |

All changes to the outputted results are saved automatically.

## Layouts

By default, the query builder will use the `Table` layout. You can switch to a different layout by hitting the more menu on the top right of the results and clicking on the `Layout` option.

The following layouts are available:

| Layout     | Description                                         | Example                      |
| ---------- | --------------------------------------------------- | ---------------------------- |
| `Line`     | Displays your data as a line chart.                 | [Link](examples.md#Line)     |
| `Bar`      | Displays your data as a bar chart.                  | [Link](examples.md#Bar)      |
| `Timeline` | Displays your data as an interactive timeline view. | [Link](examples.md#Timeline) |
| `Kanban`   | Displays your data as a Kanban board.               | [Link](examples.md#Kanban)   |

## Exporting

Next to the save button is a button that will allow you to export your results. There are currently two formats available to export to:

- CSV - All the columns in the table will become columns in the CSV
- Markdown - The columns will become frontmatter data and the children of the block or page will become markdown content.

## Styling

Every [Query Block](#query-blocks) or [Query Page](#query-pages) is rooted with a `div` that has an `id` of `roamjs-query-page-${uid}` where `uid` is the block reference of the query block or the page reference of the page. You could use this id to style individual queries with affecting other ones.

## SmartBlocks Integration

This extension comes with its own SmartBlocks command! The `<%QUERYBUILDER%>` command will run an existing [Query Block](#query-blocks) or [Query Page](#query-pages) instance in your graph and return the results as separate blocks. The command takes in multiple arguments:

1. Query reference - the block reference or [alias](#alias) of query
2. [Output format](#output-format) - the format to output each result in.

And two optional arguments (the order of these arguments does not matter):

- Limit - the number of results returned.
- [Input Variables](#input-variables) - variables to pass into the query

### Alias

You can set the alias of a [Query Block](#query-blocks) in the top right corner of the UI. See example 2 below.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FBRQ-hhJpLe.jpg?alt=media&token=d0b9afb1-0189-4904-bab8-420e032f1da6)

The end of the title of a [Query Page](#query-pages) works as well. See example 3 below.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F3VGMt6toTB.jpg?alt=media&token=51d851d3-0954-4300-9be4-2bcb13ed95d2)

### Output Format

#### Regular Output Format

- Placeholders - you can use [SmartBlock Formatting placeholders](https://github.com/RoamJs/smartblocks/blob/main/docs/050-command-reference.md#formatting), like `{text}` to insert the value from the result in.
- Selections - there's a placeholder available for each [Selection](#selections) label that you have defined in the query.
- Selection `uid` - to get the `uid` of a selection, append `-uid` to the end of the selection label, eg `{someSelection-uid}`.
- SmartBlock Commands - any SmartBlock Command will be applied to the resulting output. See example 3 below.

#### Flexible Output Format

The flexible output format allows you to define a multi-block output format.

To use the flexible output format, you pass in the `block reference` that contains the output format. Each result from the `<%QUERYBUILDER%>` command will be output with this format.

The same placeholders defined above for the regular output format are also available in the flexible output format, but you use `<%GET:placeholder%>` to get the value of a placeholder instead of `{placeholder}`.

Example

`<%QUERYBUILDER:myQuery,((ITe51brrn))%>`

Where `((ITe51brrn))` looks like this:

```
- Title:: <%GET:text%>
  - Description:: <%GET:description%>
```

### Input Variables

Input Variables are a way to pass in values into your query, allowing for dynamic adjustments based on things like user input. This feature is particularly useful in scenarios where you want to reuse a single query template with different parameters.

For example, in a task management setup, you might have a query that retrieves tasks for a specific client. Instead of creating multiple query instances for each client, you can create one query and use an input variable to specify the client name dynamically.

To pass a value to the query builder instance, use this format: `variable=value`. See example 4 below.

Then in the query builder instance, you can reference it by entering `:in variable` in supported conditions. The variable cannot contain spaces or special characters.

Here is an example of this in action:

<video src="https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F5ZN7oVnQea.mp4?alt=media&token=bc094fad-f677-4e76-a6d1-eaaf572c5fb1"></video>

[Direct Video Link](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F5ZN7oVnQea.mp4?alt=media&token=bc094fad-f677-4e76-a6d1-eaaf572c5fb1)

#### Conditions that Support Input Variables

- "has title"
- "references title"
- "is in page with title"
- "is referenced by block in page with title"
- "titled before"
- "titled after"
- "created by"
- "edited by"
- "has block reference"
- "is in canvas"

### Examples

1. `<%QUERYBUILDER:6-qLCJsSb,{text}%>`
2. `<%QUERYBUILDER:myQuery,The Result is {text} - {description}%>`
3. `<%QUERYBUILDER:queries/myQueryBlock,Random Block from {text}: <%RANDOMBLOCKFROM:{uid}%>%>`
4. `<SET:clientName,<%INPUT:Which client?,Alice,Bob,Eve%>%><%QUERYBUILDER:tasks,(({uid})),client=clientName%>`

## Developer API

For developers of other extensions who want to use the queries defined by users, we expose the following API, available on the global `window.roamjs.extension.queryBuilder` object:

- `listActiveQueries` - `() => { uid: string }[]` Returns an array of blocks or pages where the user has a query defined from query builder.
- `runQuery` - `(uid: string) => Promise<Result[]>` Runs the query defined at the input `uid` and returns a promise that resolves to the array of results from the user's graphs. `Result`s have the following schema:
  - `text` - `string` The page title or block text of the primary node involved in the result.
  - `uid` - `string` The reference of the primary node involved in the result.
  - `${string}-uid` - `string` If the users define selections that return intermediary nodes, the reference of those nodes will always end in `-uid` and will always be of type `string`.
  - `{string}` - `string | number | Date` All other fields returned in the result can be any of the primitive value types.
- `isDiscourseNode` - `(uid: string) => boolean` Returns whether the input `uid` is a discourse node.

## Examples

See more query examples here: [Link](examples.md)

### General Demo<!-- omit in toc -->

Demo showing [Query Block](#query-blocks), [Query Pages](#query-pages), [Query Drawer](#query-drawer), [Conditions](#conditions), [Selections](#selections) and a few example queries.

<video src="https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fj0Li5mCafX.mp4?alt=media&token=58ee51b2-9a7b-4547-81ad-01672b3b5820" controls="controls"></video>

[Direct Video Link](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fj0Li5mCafX.mp4?alt=media&token=58ee51b2-9a7b-4547-81ad-01672b3b5820)

### Conversation with Conor White-Sullivan<!-- omit in toc -->

About Roam Depot, extensions, and a Query Builder demo. Demo starts around 13 minutes.

(in the demo you'll see the `block` being used, but that can be interchanged with `node`)

[![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FEY0iYQHf3N.png?alt=media&token=c8958afa-0c7c-495c-908a-bd5edcb02fd1)](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FEY0iYQHf3N.png?alt=media&token=c8958afa-0c7c-495c-908a-bd5edcb02fd1)

[View on Grain](https://grain.com/share/recording/9d0e349b-bb0d-4267-a362-e2a79667b787/UOW64KlylDapMRhDJjwuTrDl8bzMOcQ3tUGECdhR)
