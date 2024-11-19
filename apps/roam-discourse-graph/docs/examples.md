# Conditions

## Created After

`created after` - The `source` block or page was created after the naturally specified `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FOikGlrvyyT.png?alt=media&token=5ffae1b0-919c-4436-81af-dbc55defee5a)

## Created Before

`created before` - The `source` block or page was created before the naturally specified `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FBguS68J5go.png?alt=media&token=58c71ada-0c33-4eaf-bd52-e0f80163acb8)

## Created By

`created by` - The `source` block or page was created by the user with a display name of `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FicdhA4FeTw.png?alt=media&token=cf6ba1b6-e241-48c9-ad00-2ee4972a4e4b)

## Edited After

`edited after` - The `source` block or page was edited after the naturally specified `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F7SdsHsbcyl.png?alt=media&token=fd957a22-fa11-4127-b2c7-487ea2fd8b60)

## Edited Before

`edited before` - The `source` block or page was edited before the naturally specified `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F4wYTiHgWLx.png?alt=media&token=4e549292-7fe0-4dd3-a771-e03a539faf17)

## Edited By

`edited by` - The `source` block or page was last edited by the user with a display name of `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fm60naQrWKT.png?alt=media&token=f922d85a-51d4-4496-b286-d99d4e0f23d1)

## Has Ancestor

`has ancestor` - The `source` block has the `target` block or page as an ancestor up the outliner tree

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fbj6Avea1Kq.png?alt=media&token=8837ec3e-819d-48ae-8aa9-aca7d7ac2bd4)

## Has Attribute

`has attribute` - The `source` block or page has an attribute with value `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FYM87Zc2PIM.png?alt=media&token=ae29dc39-0840-4976-b76e-49346f3d81e7)

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fn5uFMm5GZF.png?alt=media&token=35fd4fae-0fb0-49c1-93a6-f6ca6d488dbb)

## Has Child

`has child` - The `source` block or page has the `target` block as a child

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FE8e9aePoW_.png?alt=media&token=47253aad-016e-4d66-817f-3e05f40176a4)

## Has Descendent

`has descendent` - The `source` block or page has the `target` block as a descendant somewhere down the outliner tree

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FjnyFB1qaOz.png?alt=media&token=4f919c94-5831-4cce-9172-51b4ffd1fe85)

## Has Title

`has title` - The `source` page has the exact text `target` as a title.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FrUY8osUnNH.png?alt=media&token=fca0c9f0-d0a7-406d-a1bd-a1f350f6b767)

If `target` is equal to `{date}`, then it matches any Daily Note Page.
Supports date NLP to resolve a single date, e.g. `{date:today}`.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fn8GrKE1JGi.png?alt=media&token=293fd577-ffbb-4548-8e18-b3fcef067ed6)

The `target` also supports Regular Expressions by starting and ending the value with a `/`.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FahPpEkyBqc.png?alt=media&token=04cb4d67-02f1-4f22-83df-064f84293337)

## Is In Page

`is in page` - The `source` block is in the `target` page

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FIJYbKVhVV_.png?alt=media&token=620a9691-d7ce-44cb-90c2-058687596584)

## Is In Page With Title

`is in page with title` - The `source` block is in a page with title `target`.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FjL6XB_324l.png?alt=media&token=a21198f1-6bcc-410c-9bf1-b55a772c9837)

- If `target` is equal to `{date}`, then it matches any Daily Note Page.
- Supports date NLP to resolve a single date, e.g. `{date:today}`.
- The `target` also supports Regular Expressions by starting and ending the value with a `/`.

## Is Referenced By

`is referenced by` - The `source` block or page is referenced by the `target` block or page

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FoulzxaPQto.png?alt=media&token=4fad2ed3-5f63-4c82-8462-6bf4bfab5671)

## References

`references` - The `source` block or page references the `target` block or page

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fwd0YVGTO3p.png?alt=media&token=408a7e5c-0ce3-466b-b93f-b15fb1ba0bc0)

## References Title

`references title` - The `source` block or page references a page with `target` as the title.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F1wciIZFKPD.png?alt=media&token=94501e15-5dc9-476f-979e-d4a87215a68e)

- If `target` is equal to `{date}`, then it matches any Daily Note Page.
- Supports date NLP to resolve a single date, e.g. `{date:today}`.
- The `target` also supports Regular Expressions by starting and ending the value with a `/`.

## Titled After

`titled after` - The `source` page is a DNP that is after the naturally specified `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F0yr1G_TCZO.png?alt=media&token=05afe244-7565-41fa-ab18-3a43698675c3)

## Titled Before

`titled before` - The `source` page is a DNP that is before the naturally specified `target`

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FGC3y7RtvAg.png?alt=media&token=39bffaf8-55d8-496d-b777-6d460e286b54)

## With Text

`with text` - The `source` block or page has the exact text `target` somewhere in its block text or page title

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FxxekzVcVFu.png?alt=media&token=0d0f5ccd-69e3-4d0b-ab22-71ac2d420b88)

## With Title In Text

`with title in text` - The `source` page has the exact text `target` somewhere in its page title.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FqmjdRRoasm.png?alt=media&token=fa05fc14-f16c-4c07-a953-9066e9ef6e68)

# Selections

## Author

`Author` - The user who created the block or page

`Created By` also works.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FQCmuF5z9S0.png?alt=media&token=399e1c7f-d4ce-495a-ada3-c6732f244c1d)

## Created Date

`Created Date` - The date the block or page was created

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FwpdYTNTndC.png?alt=media&token=cf6f3925-f362-4a3d-8524-677ac8aa0998)

## Created Time

`Created Time` - The time the block or page was created in `hh:mm` format

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FBAywiABniP.png?alt=media&token=3c91728e-6ddb-4248-b7cc-e61a4dcbb0b1)

## Edited Date

`Edited Date` - The date the block or page was edited

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FjMVBuR7Z4g.png?alt=media&token=b57d283e-bb30-4a53-a8af-81e2f2476bfd)

## Edited Time

`Edited Time` - The time the block or page was edited in `hh:mm` format

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fu6z6b9AoXT.png?alt=media&token=2287c3f5-6cb1-444e-ac62-bc9e8245602d)

## Last Edited By

`Last Edited By` - The user who created the block or page

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F7QbBrAWG28.png?alt=media&token=71854f68-b7a2-4a39-bcb1-ea022471a036)

## Attribute

`{attribute}` - Returns the value of an `{attribute}` associated with the queried

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F4X1a_dvjDL.png?alt=media&token=f391ddd5-7a93-4a4e-9ad2-8fa0839e5183)

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FVsL15EzoYE.png?alt=media&token=32aa9098-9a45-4b67-be96-68e78839e127)

## Intermediate Node

`node:{node}` - Returns any intermediary node you defined in one of the conditions.

- `node:Joke` will return the title of a `Joke` referenced in a condition.
- `node:placeholder` will return the title of a `placeholder` referenced in a condition.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FuEjt9_ti4D.png?alt=media&token=e32b2c64-aed8-4160-9c13-35ed7e92fb9e)

## Data

`node:{node}:{data}` - Specify one of the first six options as the field to return the related metadata for the intermediary node.

Metadata

`node:thisIsChildNode:Author` will return the user who created the `thisIsChildNode` node defined in a condition.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FkyYbmJMBg0.png?alt=media&token=c62040c1-e35f-4b2a-a0f6-966614c7ae85)

Attribute

`node:thisIsPlaceholder:Client` will return the value of the `Client` attribute from the `thisIsPlaceholder` node defined in a condition.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FKJjaKl2L4m.png?alt=media&token=40b943a2-e005-45a1-b491-dd07a585cc92)

## Regular Expression

`node:{node}:/regular_expression/` - returns match according to a regular expression between `/`'s.

`node:node:/(\d\d?:\d\d)/` will return time in the format of "hours:minutes" from the main `node` being queried

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FO1bsQVgsqV.png?alt=media&token=d3cac8f3-91f3-4600-9cb5-58a8c2c427fa)

`node:placeholder:/#([^\s]*)/` will return the text after the first hashtag from the `placeholder` node defined in a condition.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FNzKWXuYAkz.png?alt=media&token=bfd3e0b3-3eb8-4ebe-92e7-34a9e0c9a1ec)

## First Column Header

`node` - Use the label to edit the column header of the first column

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2F4NcO5GSexN.png?alt=media&token=25f177d1-ba02-448c-be11-2d227228a092)

## Add or Subtract

`add({alias1},{alias2})` - Add the values of two columns.

`subtract({alias1},{alias2})` - Subtract the values betweenn two columns.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FSQKkdU74Lj.png?alt=media&token=a90e6039-0273-43b1-b146-80461fced14d)

Supports adding values to dates.

If one of the aliases is `today`, then today's date will be used.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fz7UNWC6zmZ.png?alt=media&token=e2f13f04-d2cb-4055-9493-4f9b367e97b7)

# Layouts

The following layouts are available for displaying your data:

## Line

Displays your data as a line chart.

You need to have at least **two** selections for this layout to work

- The **first** is a selection that returns **date values**
- all subsequent selections return **numeric values**.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FcyH1o3W2A-.png?alt=media&token=e33c1538-df51-4562-8b4b-fd62915bee14)

## Bar

Displays your data as a bar chart.

You need to have at least **two** selections for this layout to work

- The **first** is a selection that returns **date values**
- all subsequent selections return **numeric values**.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FEWXzDLeCQm.png?alt=media&token=c4a486ec-eacd-45f2-a743-6064ad878030)

## Timeline

Displays your data as an interactive timeline view.

- You need to have a selection chosen labelled **Date** that returns **date values** for this layout to work.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2Fidy6jxjt_q.png?alt=media&token=f231589f-e0b5-40ec-8763-bd1e908cf374)

## Kanban

Displays your data as a Kanban board.

![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Froamjs%2FmFXEq6cbpA.png?alt=media&token=19e33fc4-91fd-440b-816c-6df667814c5f)
