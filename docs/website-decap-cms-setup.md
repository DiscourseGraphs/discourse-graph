# Website Decap CMS setup

## Required environment variables

Set these in the website deployment environment:

- `DECAP_GITHUB_CLIENT_ID`
- `DECAP_GITHUB_CLIENT_SECRET`
- `DECAP_OAUTH_BASE_URL`

Example:

```env
DECAP_GITHUB_CLIENT_ID=...
DECAP_GITHUB_CLIENT_SECRET=...
DECAP_OAUTH_BASE_URL=https://discoursegraphs.com
```

## GitHub OAuth app

Create a GitHub OAuth app and configure:

- Homepage URL: `https://discoursegraphs.com`
- Authorization callback URL: `https://discoursegraphs.com/callback`

For local testing, use your local site URL instead:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/callback`

Then set `DECAP_OAUTH_BASE_URL` to the same origin you are testing against.

## Pilot routes

- Admin UI: `/admin`
- OAuth start: `/auth`
- OAuth callback: `/callback`

## Current pilot scope

- Blog posts in `apps/website/content/blog`
- Landing pages in:
  - `apps/website/content/index.mdx`
  - `apps/website/content/roam/index.mdx`
  - `apps/website/content/obsidian/index.mdx`
  - `apps/website/content/blog/index.mdx`
- Existing Roam docs pages under `apps/website/content/roam/**`
- Existing Obsidian docs pages under `apps/website/content/obsidian/**`

## Current limitations

- The editor uses raw MDX, not a true WYSIWYG editor.
- In-app Decap preview is disabled.
- Existing docs pages are edit-only in the CMS.
- Docs navigation still comes from `_meta.ts` files and is not managed in the CMS.
- Use the generated Vercel preview deployment to review the final render before merge.
