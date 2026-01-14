import { NavigationList } from "~/components/Navigation";

const ROOT = "/docs/roam";

export const navigation: NavigationList = [
  {
    title: "🏠 Welcome!",
    links: [
      { title: "Getting started", href: `${ROOT}/getting-started` },
      { title: "Installation", href: `${ROOT}/installation` },
    ],
  },
  {
    title: "🗺️ Guides",
    links: [
      {
        title: "Creating nodes",
        href: `${ROOT}/creating-discourse-nodes`,
      },
      {
        title: "Tagging candidate nodes",
        href: `${ROOT}/tagging-candidate-nodes`,
      },
      {
        title: "Creating relationships",
        href: `${ROOT}/creating-discourse-relationships`,
      },
      {
        title: "Exploring",
        href: `${ROOT}/exploring-discourse-graph`,
      },
      {
        title: "Querying",
        href: `${ROOT}/querying-discourse-graph`,
      },
      {
        title: "Extending",
        href: `${ROOT}/extending-personalizing-graph`,
      },
      {
        title: "Sharing",
        href: `${ROOT}/sharing-discourse-graph`,
      },
    ],
  },
  {
    title: "🧱 Fundamentals",
    links: [
      {
        title: "What is a discourse graph?",
        href: `${ROOT}/what-is-discourse-graph`,
      },
      {
        title: "Grammar",
        href: `${ROOT}/grammar`,
      },
    ],
  },
  {
    title: "🚢 Use cases",
    links: [
      {
        title: "Literature reviewing",
        href: `${ROOT}/literature-reviewing`,
      },
      {
        title: "Zettelkasten",
        href: `${ROOT}/enhanced-zettelkasten`,
      },
      {
        title: "Reading clubs / seminars",
        href: `${ROOT}/reading-clubs`,
      },
      {
        title: "Lab notebooks",
        href: `${ROOT}/lab-notebooks`,
      },
      {
        title: "Product / research roadmapping",
        href: `${ROOT}/research-roadmapping`,
      },
    ],
  },
];
