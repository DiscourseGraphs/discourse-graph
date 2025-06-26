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
        href: `${ROOT}/grammar`,
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
        title: "Creating Relationships",
        href: `${ROOT}/creating-discourse-relationships`,
      },
      {
        title: "Exploring Your Graph",
        href: `${ROOT}/exploring-discourse-graph`,
      },
      {
        title: "Using Discourse Context",
        href: `${ROOT}/using-discourse-context`,
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
        title: "Extending & Personalizing",
        href: `${ROOT}/extending-personalizing-graph`,
      },
    ],
  },
  {
    title: "🔍 Advanced Features",
    links: [
      {
        title: "Using Templates",
        href: `${ROOT}/using-templates`,
      },
      {
        title: "Keyboard Shortcuts",
        href: `${ROOT}/keyboard-shortcuts`,
      },
      {
        title: "Command Palette Integration",
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
