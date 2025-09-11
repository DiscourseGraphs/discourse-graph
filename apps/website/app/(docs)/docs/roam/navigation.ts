import { NavigationList } from "~/components/Navigation";

const ROOT = "/docs/roam";

export const navigation: NavigationList = [
  {
    title: "🏠 Welcome!",
    links: [
      { title: "Getting Started", href: `${ROOT}/getting-started` },
      { title: "Installation", href: `${ROOT}/installation` },
    ],
  },
  {
    title: "🗺️ GUIDES",
    links: [
      {
        title: "Creating Nodes",
        href: `${ROOT}/creating-discourse-nodes`,
      },
      {
        title: "Tagging Potential Nodes",
        href: `${ROOT}/tagging-candidate-nodes`,
      },
      {
        title: "Creating Relationships",
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
    title: "🚢 USE CASES",
    links: [
      {
        title: "Literature Reviewing",
        href: `${ROOT}/literature-reviewing`,
      },
      {
        title: "Zettelkasten",
        href: `${ROOT}/enhanced-zettelkasten`,
      },
      {
        title: "Reading Clubs / Seminars",
        href: `${ROOT}/reading-clubs`,
      },
      {
        title: "Lab notebooks",
        href: `${ROOT}/lab-notebooks`,
      },
      {
        title: "Product / Research Roadmapping",
        href: `${ROOT}/research-roadmapping`,
      },
    ],
  },
];
