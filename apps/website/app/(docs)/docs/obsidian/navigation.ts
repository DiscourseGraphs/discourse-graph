import { NavigationList } from "~/components/Navigation";

const ROOT = "/docs/obsidian";

export const navigation: NavigationList = [
  {
    title: "🏠 Getting started",
    links: [
      { title: "Getting started", href: `${ROOT}/getting-started` },
      { title: "Installation", href: `${ROOT}/installation` },
    ],
  },
  {
    title: "🧱 Fundamentals",
    links: [
      {
        title: "What is a discourse graph?",
        href: `${ROOT}/what-is-a-discourse-graph`,
      },
      {
        title: "Grammar",
        href: `${ROOT}/base-grammar`,
      },
    ],
  },
  {
    title: "⚙️ Configuration",
    links: [
      {
        title: "Node types & templates",
        href: `${ROOT}/node-types-templates`,
      },
      {
        title: "Relationship types",
        href: `${ROOT}/relationship-types`,
      },
      {
        title: "General settings",
        href: `${ROOT}/general-settings`,
      },
    ],
  },
  {
    title: "🗺️ Core features",
    links: [
      {
        title: "Creating nodes",
        href: `${ROOT}/creating-discourse-nodes`,
      },
      {
        title: "Discourse context",
        href: `${ROOT}/discourse-context`,
      },
      {
        title: "Creating relationships",
        href: `${ROOT}/creating-discourse-relationships`,
      },
      {
        title: "Canvas",
        href: `${ROOT}/canvas`,
      },
      {
        title: "Node tags",
        href: `${ROOT}/node-tags`,
      },
      {
        title: "Querying your discourse graph",
        href: `${ROOT}/querying-discourse-graph`,
      },
    ],
  },

  {
    title: "🔍 Advanced features",
    links: [
      {
        title: "Commands",
        href: `${ROOT}/command-palette`,
      },
    ],
  },
  {
    title: "🚢 Use cases",
    links: [
      {
        title: "Literature review",
        href: `${ROOT}/literature-reviewing`,
      },
      {
        title: "Research notes",
        href: `${ROOT}/research-roadmapping`,
      },
      {
        title: "Reading clubs & seminars",
        href: `${ROOT}/reading-clubs`,
      },
      {
        title: "Lab notebooks",
        href: `${ROOT}/lab-notebooks`,
      },
    ],
  },
];
