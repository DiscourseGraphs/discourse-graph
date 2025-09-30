<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/69705f59-03d8-4b9b-898f-ad32188b6d05">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/07732ca9-fd37-4e78-8326-086ec3f35d12">
  <img alt="Shows project promo image in light and dark mode">
</picture>

Welcome to the monorepo for [Discourse Graphs](https://discoursegraphs.com). Discourse Graphs serve as a tool and ecosystem for collaborative knowledge synthesis.

## Local development

### Turborepo

This repository uses [Turborepo](https://turbo.build/repo/docs) as a build system, enabling a streamlined and efficient workflow for managing multiple applications and shared packages in a monorepo setup.

Using Turborepo allows for things like:

- **Centralize shared resources**: Shared configurations, utilities, and components are maintained in a single place, reducing duplication and inconsistency.
- **Incremental builds**: Only changes in code are rebuilt, which speeds up development.
- **Parallel processing**: Tasks across applications and packages run concurrently, saving time.
- **Dependency graph management**: Turborepo tracks relationships between projects, ensuring that tasks run in the correct order.

Learn more about how monorepos improve development workflows [here](https://vercel.com/blog/monorepos) and [here](https://github.com/babel/babel/blob/master/doc/design/monorepo.md).

### Apps & Packages

`apps`

- [website](https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/website): The public-facing website for Discourse Graphs, available at [discoursegraphs.com](https://discoursegraphs.com). Uses Next.js.
- [roam](https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/roam): The Roam Research extension that implements the Discourse Graph protocol.
- [obsidian](https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/obsidian): The Obsidian plugin that implements the Discourse Graph protocol.

`packages`

- [tailwind-config](https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/tailwind-config): Shared tailwind config
- [typescript-config](https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/typescript-config): Shared tsconfig.jsons
- [eslint-config](https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/eslint-config): ESLint preset
- [ui](https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/ui): Core React components

### Getting Started

To get started with local development:

1. Clone the repository:

```bash
git clone https://github.com/DiscourseGraphs/discourse-graph.git
```

2. Install dependencies:

```bash
cd discourse-graph
npm install -g pnpm@10
pnpm install
```

3. Run all applications in development mode:

```bash
turbo dev
```

You can use the `--filter` flag to run a single application, eg:

```bash
turbo dev --filter roam
```

#### Roam

- go to your graph, open up settings, and go to the extensions tab
- click "Enable developer mode (the settings cog icon)
- click "Load extension"
- and choose the `dist` folder on your computer which is in the `discourse-graph/apps/roam` directory
- you can set a hotkey to `Reload developer extension`

#### Obsidian

- copy the `.env.example` file to `.env`
- fill in the `OBSIDIAN_PLUGIN_PATH` with the path to your Obsidian plugins folder
- run `turbo dev --filter @discourse-graphs/obsidian`
- install the [Plugin Reloader](https://obsidian.md/plugins?id=plugin-reloader) or [BRAT](https://obsidian.md/plugins?id=obsidian42-brat)/[Hot Reload](https://github.com/pjeby/hot-reload) to reload the plugin after changes

## Contributing

Please see our [contributing guide](CONTRIBUTING.md).

Also see our [style guide](STYLE_GUIDE.md) for more information on the specifics of our coding standards.

Found a bug? Please [submit an issue](https://github.com/DiscourseGraphs/discourse-graph/issues).

## Community

Have questions, comments or feedback? Join our [Slack](https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg).

## Supporters

- [Protocol Labs Research](https://research.protocol.ai/)
- [Chan Zuckerberg Initiative](https://cziscience.medium.com/request-for-information-pathways-to-ai-enabled-research-55c52124def4)
- [Metagov](https://www.metagov.org/)
- [Schmidt Futures](https://experiment.com/grants/metascience)
- [The Navigation Fund](https://commons.datacite.org/doi.org/10.71707/cx83-dh41)

## Acknowledgement

This project builds upon the foundational work of [David Vargas](https://github.com/dvargas92495) and his suite of [RoamJS](https://github.com/RoamJS) plugins. His innovative contributions laid the groundwork for what Discourse Graphs has become today. We are deeply grateful for his vision and dedication, which have been instrumental in shaping this project.
