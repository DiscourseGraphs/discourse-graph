# Contributing

We appreciate your interest in helping improve [Discourse Graphs](https://github.com/DiscourseGraphs/discourse-graph)! Contributions, whether in code or documentation, are always welcome. 🙌

## Start With an Issue

Before diving into a pull request, it’s a good idea to [open an issue](https://github.com/DiscourseGraphs/discourse-graph/issues/new/) to discuss what you have in mind. This ensures your work aligns with the project’s goals and reduces the chance of duplicating ongoing efforts.

If you’re uncertain about the value of your proposed change, don’t hesitate to create an issue anyway 😄. We’ll review it together, and once we agree on next steps, you can confidently move forward.

## Making Your Changes

Here’s how to contribute:

1. [Fork](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo) and [clone](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) the repository.
2. [Create a new branch](https://docs.github.com/en/desktop/contributing-and-collaborating-using-github-desktop/managing-branches) for your updates.
3. Implement your changes, making sure your code:
   - Is formatted with [Prettier](https://prettier.io)
   - Follows our [Style Guide](./STYLE_GUIDE.md)
   - Passes all [TypeScript](https://www.typescriptlang.org/) type checks
4. Write tests that validate your change and/or fix.
<!-- 5. Run `turbo build` followed by `turbo test` to confirm everything works. -->
5. Push your branch and open a pull request. 🚀

## Adding Documentation to the Website

The Discourse Graphs website hosts documentation for both plugins and general information. Here's how to add or edit documentation:

### Blog Posts

Blog posts are located in `/apps/website/app/(home)/blog/posts/`

1. **Create your post file**: Copy `EXAMPLE.md` as a starting template and rename it to your desired URL slug (e.g., `my-new-post.md`)

2. **Required metadata**: Every blog post must start with YAML frontmatter (reference `EXAMPLE.md` for the exact format):
   ```yaml
   ---
   title: "Your Post Title"
   date: "YYYY-MM-DD"
   author: "Author's name"
   published: true # Set to true to make the post visible
   ---
   ```

3. **Content**: Write your content below the frontmatter using standard Markdown

### Plugin Documentation

Plugin documentation is organized in `/apps/website/app/(docs)/docs/` with separate folders:
- `/obsidian/pages/` - Obsidian plugin documentation
- `/roam/pages/` - Roam Research extension documentation  
- `/shared/` - Shared configuration files
- `/sharedPages/` - Documentation shared between platforms

1. **Create your documentation file**: Add a new `.md` file in the appropriate platform's `pages/` folder
2. **Use standard Markdown**: No special frontmatter is required for documentation files
3. **Update navigation**: You may need to update the corresponding `navigation.ts` file to include your new page in the sidebar

### Images and Media

All images should be placed in `/apps/website/public/` following this structure:
- **General images**: `/public/` (root level for general website images)
- **Documentation images**: `/public/docs/[platform]/` (e.g., `/public/docs/roam/` for Roam documentation images)
- **Team photos**: `/public/team/`
- **Other assets**: Use appropriate subfolders like `/public/social/`, `/public/supporter-logos/`, etc.

When referencing images in your documentation, use relative paths from the public folder:
```markdown
![Alt text](/docs/roam/my-image.png)
```

### Running the Website Locally

To preview your changes locally:

1. **Environment setup**: Copy `/apps/website/.env.example` to `/apps/website/.env.local` and configure any necessary environment variables
2. **Install dependencies**: Run `npm install` from the project root
3. **Start development server**: Run `npm run dev` or `turbo dev` to start the website locally
4. **View your changes**: Navigate to `http://localhost:3000` to see your documentation

The website uses Next.js with the App Router, so changes to Markdown files should be reflected automatically during development.
