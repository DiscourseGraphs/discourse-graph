import { NavigationList } from "~/components/Navigation";

const ROOT = "/docs/obsidian";

export const navigation: NavigationList = [
  {
    title: "🏠 Getting Started",
    links: [
      { title: "Getting Started", href: `${ROOT}/getting-started` },
      { title: "Installation", href: `${ROOT}/installation` },
    ],
  },
  {
    title: "🧱 FUNDAMENTALS",
    links: [
      {
        title: "What is a Discourse Graph?",
        href: `${ROOT}/what-is-discourse-graph`,
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
        title: "Node Types & Templates",
        href: `${ROOT}/node-types-templates`,
      },
      {
        title: "Relationship Types",
        href: `${ROOT}/relationship-types`,
      },
      {
        title: "General Settings",
        href: `${ROOT}/general-settings`,
      },
    ],
  },

  {
    title: "🗺️ Core Features",
    links: [
      {
        title: "Creating Nodes",
        href: `${ROOT}/creating-discourse-nodes`,
      },
      {
        title: "Discourse Context",
        href: `${ROOT}/discourse-context`,
      },
      {
        title: "Creating Relationships",
        href: `${ROOT}/creating-discourse-relationships`,
      },
    ],
  },

  {
    title: "🔍 Advanced Features",
    links: [
      {
        title: "Commands",
        href: `${ROOT}/command-palette`,
      },
    ],
  },
  {
    title: "🚢 Use Cases",
    links: [
      {
        title: "Literature Review",
        href: `${ROOT}/literature-reviewing`,
      },
      {
        title: "Research Notes",
        href: `${ROOT}/research-roadmapping`,
      },
      {
        title: "Reading Clubs & Seminars",
        href: `${ROOT}/reading-clubs`,
      },
      {
        title: "Lab Notebooks",
        href: `${ROOT}/lab-notebooks`,
      },
    ],
  },
];
