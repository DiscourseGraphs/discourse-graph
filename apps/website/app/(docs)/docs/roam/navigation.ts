import { NavigationList } from "~/components/Navigation";

const root = "/docs/roam";

export const navigation: NavigationList = [
  {
    title: "🏠 Welcome!",
    links: [
      { title: "Getting Started", href: `${root}/getting-started` },
      { title: "Installation", href: `${root}/installation` },
    ],
  },
  {
    title: "🗺️ GUIDES",
    links: [
      {
        title: "Creating Nodes",
        href: `${root}/creating-discourse-nodes`,
      },
      {
        title: "Creating Relationships",
        href: `${root}/creating-discourse-relationships`,
      },
      {
        title: "Exploring",
        href: `${root}/exploring-discourse-graph`,
      },
      {
        title: "Querying",
        href: `${root}/querying-discourse-graph`,
      },
      {
        title: "Extending",
        href: `${root}/extending-personalizing-graph`,
      },
      {
        title: "Sharing",
        href: `${root}/sharing-discourse-graph`,
      },
    ],
  },
  {
    title: "🧱 FUNDAMENTALS",
    links: [
      {
        title: "What is a Discourse Graph?",
        href: `${root}/what-is-discourse-graph`,
      },
      {
        title: "Grammar",
        href: `${root}/extension-grammar`,
      },
      {
        title: "The Base Grammar",
        href: `${root}/base-grammar`,
      },
    ],
  },
  {
    title: "🚢 USE CASES",
    links: [
      {
        title: "Literature Reviewing",
        href: `${root}/literature-reviewing`,
      },
      {
        title: "Zettelkasten",
        href: `${root}/enhanced-zettelkasten`,
      },
      {
        title: "Reading Clubs / Seminars",
        href: `${root}/reading-clubs`,
      },
      {
        title: "Lab notebooks",
        href: `${root}/lab-notebooks`,
      },
      {
        title: "Product / Research Roadmapping",
        href: `${root}/research-roadmapping`,
      },
    ],
  },
];
