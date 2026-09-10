import type { NewsItem } from "~/types/news";
import { formatDisplayDate } from "~/utils/formatDate";

type StaticEventSource = {
  // Overrides the date shown in `meta`, for events spanning multiple days
  // (e.g. "February 23-24, 2025") that a single `date` can't represent.
  dateLabel?: string;
  date: string;
  href: string;
  linkText: string;
  location: string;
  title: string;
};

const STATIC_EVENT_SOURCES: StaticEventSource[] = [
  {
    date: "2026-06-18",
    href: "https://discoursegraphs.github.io/panel-qa-site/",
    linkText: "View panel notes",
    location: "Zoom",
    title: "Frontiers in Research: Open Science Catalyze Panel",
  },
  {
    date: "2026-03-27",
    href: "https://bsky.app/profile/atproto.science/post/3mh6kak5agk2z",
    linkText: "View event post",
    location: "ATScience Conference, Vancouver",
    title: "Toward Modular Open Science",
  },
  {
    date: "2026-03-24",
    href: "https://www.mcgill.ca/qls/channels/event/qls-seminar-series-matthew-akamatsu-371875",
    linkText: "View seminar details",
    location: "Montreal",
    title: "Seminar: McGill University Quantitative Life Sciences program",
  },
  {
    date: "2025-11-19",
    href: "https://luma.com/jijn0d5k",
    linkText: "View talk page",
    location: "Zoom",
    title:
      "Metagov x Future of Science Seminar: Interoperable LLM- and human-centered research with Discourse Graphs",
  },
  {
    date: "2025-02-23",
    dateLabel: "February 23-24, 2025",
    href: "https://iosp.io/schedule",
    linkText: "View full schedule",
    location: "Denver Museum of Nature and Science",
    title: "IOSP '25 Winter Workshop: Discourse Graphs",
  },
];

export const STATIC_NEWS_ITEMS: NewsItem[] = STATIC_EVENT_SOURCES.map(
  (event) => ({
    date: event.date,
    href: event.href,
    linkText: event.linkText,
    meta: `${event.dateLabel ?? formatDisplayDate(event.date)} | ${event.location}`,
    title: event.title,
  }),
);
