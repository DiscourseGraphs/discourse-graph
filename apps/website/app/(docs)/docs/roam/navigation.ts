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
        title: "Stored relations",
        href: `${ROOT}/stored-relations`,
      },
      {
        title: "Migration to stored relations",
        href: `${ROOT}/migration-to-stored-relations`,
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
      {
        title: "Experiment tracking",
        href: `${ROOT}/experiment-tracking`,
      },
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
        href: `${ROOT}/grammar`,
      },
    ],
  },
  {
    title: "🚢 Use cases",
    links: [
      {
        title: "Build and Utilize a Personal Knowledge Base",
        href: `${ROOT}/build-utilize-personal-knowledge-base`,
      },
      {
        title: "Synthesize Insights from the Literature",
        href: `${ROOT}/synthesize-insights-from-literature`,
      },
      {
        title: "Share your ideas & research",
        href: `${ROOT}/share-your-ideas-and-research`,
      },
      {
        title: "Track your Projects and Experiments",
        href: `${ROOT}/track-your-projects-and-experiments`,
      },
    ],
  },
];
