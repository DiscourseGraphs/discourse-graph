# Contributing

We appreciate your interest in helping improve [Discourse Graphs](https://github.com/DiscourseGraphs/discourse-graph)! Contributions, whether in code or documentation, are always welcome. 🙌

## Start With an Issue

Before diving into a pull request, it’s a good idea to [open an issue](https://github.com/DiscourseGraphs/discourse-graph/issues/new/) to discuss what you have in mind. This ensures your work aligns with the project’s goals and reduces the chance of duplicating ongoing efforts.

If you’re uncertain about the value of your proposed change, don’t hesitate to create an issue anyway 😄. We’ll review it together, and once we agree on next steps, you can confidently move forward.

## Making Your Changes

Here’s how to contribute:

1. [Fork](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo) or [clone](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) the repository.
2. [Create a new branch](https://docs.github.com/en/desktop/contributing-and-collaborating-using-github-desktop/managing-branches) for your updates.
3. Implement your changes, making sure your code:
   - Is formatted with [Prettier](https://prettier.io)
   - Follows our [Style Guide](./STYLE_GUIDE.md)
   - Passes all [TypeScript](https://www.typescriptlang.org/) type checks
4. Write tests that validate your change and/or fix.
<!-- 5. Run `turbo build` followed by `turbo test` to confirm everything works. -->
5. Push your branch and open a pull request. 🚀

## Adding Documentation to the Website

The Discourse Graphs website hosts documentation for plugins and general information. Here's how to add or edit documentation:

### Blog Posts

Blog posts are located in `/apps/website/content/blog/`

1. **Create your post file**: Copy `EXAMPLE.mdx` as a starting template and rename it to your desired URL slug (for example, `my-new-post.mdx`)

2. **Required metadata**: Every blog post must start with YAML frontmatter (reference `EXAMPLE.mdx` for the exact format):

   ```yaml
   ---
   title: "Your post title"
   date: "YYYY-MM-DD"
   author: "Author name"
   published: true
   tags:
     - release
   description: "Optional summary used for metadata."
   ---
   ```

3. **Content**: Write your content below the frontmatter using Markdown or MDX. Blog posts render through Nextra, so standard markdown features and Nextra components are available.

### Plugin Documentation

Plugin docs live in the Nextra content tree:

- **Obsidian docs:** `apps/website/content/obsidian/...`
- **Roam docs:** `apps/website/content/roam/...`

Sidebar order comes from the nearest `_meta.ts` file in the content tree. If you add a page, add the Markdown or MDX file in the right section and update that section's `_meta.ts`.

Flat legacy redirects, such as `/docs/obsidian/<slug>` to `/docs/obsidian/<section>/<slug>`, are maintained in `apps/website/docsRouteMap.ts`.

Use existing Nextra Markdown, MDX, and `nextra/components` features for styling and layout before proposing anything custom. For example, use Nextra callouts, cards, steps, tabs, tables, and file trees when those fit the content.

If the docs need a styling or presentation feature that Nextra does not currently provide, create a separate Linear ticket to add that Nextra functionality. Do not include theme, layout, route, component, or CSS changes in a content-only docs update.

Preferred: Use the `$update-user-docs` skill to update plugin docs. Detailed guidance for plugin docs lives next to the `$update-user-docs` skill:

- **[llm-authoring-guide.md](./skills/update-user-docs/references/llm-authoring-guide.md)** - a short guide non-devs can give to an LLM before asking it to write or update docs
- **[navigation-mapping.md](./skills/update-user-docs/references/navigation-mapping.md)** - how `_meta.ts` controls sidebar registration and when `docsRouteMap.ts` needs a redirect
- **[doc-conventions.md](./skills/update-user-docs/references/doc-conventions.md)** - filenames, frontmatter, screenshots, and cross-links
- **[scope-detection.md](./skills/update-user-docs/references/scope-detection.md)** - how changed file paths map to Obsidian, Roam, both-platform, or docs-site updates

### Documentation Images

All documentation images should be placed in `/apps/website/public/docs/[platform]/` following this structure:

- **Platform-specific images**: `/public/docs/[platform]/` (e.g., `/public/docs/roam/`, `/public/docs/obsidian/`)
- **General documentation images**: `/public/docs/`

When referencing images in your documentation, use relative paths from the public folder:

```markdown
![Alt text](/docs/roam/my-image.png)
```

### Running the Website Locally

To preview your changes locally:

1. **Environment setup**: Copy `/apps/website/.env.example` to `/apps/website/.env` and configure any necessary environment variables
2. **Install dependencies**: Run `pnpm install` from the project root
3. **Start development server**: Run `pnpm exec turbo dev -F website` or navigate to `apps/website` and run `pnpm dev` to start the website locally
4. **View your changes**: Navigate to `http://localhost:3000` to see your documentation

The website uses Next.js with the App Router, so changes to Markdown files should be reflected automatically during development.
