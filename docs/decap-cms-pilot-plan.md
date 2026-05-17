# Minimal Decap pilot for `apps/website`

## Summary

Ship the smallest useful Decap integration to validate the workflow without reshaping the docs system.

Pilot scope:

- Decap admin in `apps/website`
- GitHub auth on the production site
- editable blog posts
- editable singleton MDX pages for a small Nextra compatibility check
- repo-based media uploads

Do not include full docs collections, docs navigation management, or in-CMS preview in the pilot.

## Implementation changes

- Add a lightweight `/admin` route inside the Next app and initialize Decap from code.
- Add GitHub OAuth endpoints for Decap:
  - `GET /auth`
  - `GET /callback`
- Use GitHub backend with:
  - `repo: DiscourseGraphs/discourse-graph`
  - `branch: main`
  - `publish_mode: editorial_workflow`
  - `open_authoring: true`
- Add env vars for the OAuth flow:
  - `DECAP_GITHUB_CLIENT_ID`
  - `DECAP_GITHUB_CLIENT_SECRET`
  - `DECAP_OAUTH_BASE_URL`
- Configure the pilot collections:
  - `blog_posts`
    - folder: `apps/website/content/blog`
    - `create: true`
    - exclude `index.mdx`
    - fields: `title`, `date`, `author`, `description`, `tags`, `body`
    - hidden compatibility field: `published: true`
  - `site_pages`
    - file collection for:
      - `apps/website/content/blog/index.mdx`
      - `apps/website/content/index.mdx`
    - edit-only, no create/delete
- Store uploaded media in `apps/website/public/uploads` and reference it via `/uploads/...`.
- Disable Decap's editor preview for all pilot collections.
- Remove `content/blog/EXAMPLE.mdx` from the live authoring path and replace it with short editor-facing CMS docs.

## Gotchas

- Decap will edit `.mdx` files correctly, but it is not a real MDX/Nextra WYSIWYG editor.
- The pilot should assume editors are editing markdown-like content with occasional MDX, not arbitrary JSX-heavy page composition.
- In-app preview stays off in the pilot because the default Decap preview will not match the real Nextra render for MDX pages with imports and components.
- The real preview path in the pilot is GitHub PR review plus the normal Vercel preview deployment.
- Open authoring still requires editors to use GitHub accounts.
- Docs drafts are not fully implemented today. Blog posts already respect `published`; docs routes do not. Do not treat `published` as an editor-facing workflow control in the pilot.
- Full docs navigation is still code-driven through `content/**/_meta.ts`, so Decap will not manage sidebar order, labels, or new docs page placement in the pilot.

## Upgrade triggers

- Need to edit existing docs pages broadly:
  - add section-based edit-only docs collections over `content/roam/**` and `content/obsidian/**`
- Need to create new docs pages:
  - first move docs navigation and order out of `_meta.ts` into CMS-managed data
- Need in-CMS preview:
  - add custom Decap preview templates and styles, or wire preview links to Vercel deploy previews
- Need true WYSIWYG or block editing for MDX:
  - this is the point to reassess Tina instead of pushing Decap further
- Need drafts to exist on `main` without publishing:
  - add route-side docs frontmatter gating, not just search-index filtering
- Need non-GitHub editors or richer editorial collaboration:
  - reassess auth and workflow or move to a different CMS

## Test plan

- `pnpm --dir apps/website check-types`
- `pnpm --dir apps/website lint`
- `pnpm --dir apps/website build`
- Manual pilot checks:
  - `/admin` loads
  - GitHub login works
  - an editor can create a blog draft PR
  - an editor can edit `content/index.mdx` and see the result on a Vercel preview
  - uploaded images render correctly from `/uploads/...`

## Assumptions

- The goal of this pilot is workflow validation, not full docs CMS coverage.
- Production URL will host the OAuth flow.
- The repository remains public and GitHub-based.
- If the pilot succeeds, the next expansion should be docs edit-only collections before any attempt at full docs IA or WYSIWYG.
