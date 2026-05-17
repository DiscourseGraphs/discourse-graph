# Website CMS editor guide

## What this is

The website CMS pilot lets you edit a small set of content on the website without changing code directly.

Current pilot scope:

- blog posts
- docs landing pages
- existing Roam docs pages
- existing Obsidian docs pages

## How to use it

1. Open `/admin` on the production website.
2. Sign in with GitHub.
3. Choose the content entry you want to edit.
4. Save your draft in the CMS.
5. Open the generated pull request.
6. Review the Vercel preview deployment before merging.

## Important limitations

- The body editor stores raw MDX. It is not a true WYSIWYG editor.
- Keep any existing imports and Nextra components intact.
- Use the Vercel preview deployment to check how the page really renders.
- Blog posts support create and edit in the CMS.
- Docs pages are edit-only in this pilot. Creating new docs pages is still a developer task.
- The docs navigation and section structure are not managed by the CMS yet.

## Media uploads

- Uploads are stored in `apps/website/public/uploads`.
- Blog images go under `/uploads/blog/...`.
- Landing page images go under `/uploads/pages/...`.
- Docs images go under `/uploads/docs/...`.

## When to ask a developer for help

- You need a brand new docs page or docs section.
- You need sidebar order or labels changed.
- You need a page that uses custom JSX or more advanced MDX patterns.
- The Vercel preview does not match what you expected.
