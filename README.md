Welcome to the monorepo for [Discourse Graphs](https://discoursegraphs.com). Discourse Graphs serve as a tool and ecosystem for collaborative knowledge synthesis.

## Local development

To get started with local development:

1. Clone the repository:

```bash
git clone https://github.com/DiscourseGraphs/discourse-graph.git
```

2. Install dependencies:

```bash
cd discourse-graph
npm install
```

3. Run all applications in development mode:

```bash
turbo dev
```

You can use the `--filter` flag to run a single application:

```bash
turbo dev --filter roam
```

### Turborepo

This repository uses [Turborepo](https://turbo.build/repo/docs) as a build system. Turborepo is a high-performance build system for JavaScript and TypeScript codebases. It was designed after the workflows used by massive software engineering organizations to ship code at scale. Turborepo abstracts the complex configuration needed for monorepos and provides fast, incremental builds with zero-configuration remote caching.

Using Turborepo simplifies managing your design system monorepo, as you can have a single lint, build, test, and release process for all packages. Learn more about how [monorepos](https://vercel.com/blog/monorepos) improve your development workflow.

### Apps & Packages

This Turborepo includes the following packages and applications:

- [apps/website](https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/website): The public-facing website for Discourse Graphs, available at [discoursegraphs.com](https://discoursegraphs.com). Uses Next.js.
- [apps/roam](https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/roam): The Roam Research extension that implements the Discourse Graph protocol.
- [packages/typescript-config](https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/typescript-config): Shared tsconfig.jsons used throughout the Turborepo
- [packages/eslint-config](https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/eslint-config): ESLint preset
- [packages/ui](https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/ui): Core React components

### Deployment

- The Next.js website is automatically deployed to Vercel.
- The Roam Discourse Graph extension is manually deployed to Vercel blob storage using `npm run deploy`. (this will be automated in the future)

## Contributing

Please see our [contributing guide](CONTRIBUTING.md). Found a bug? Please [submit an issue](https://github.com/DiscourseGraphs/discourse-graph/issues).

## Community

Have questions, comments or feedback? Join our [discord](https://discord.gg/atWk6gJyjE).
