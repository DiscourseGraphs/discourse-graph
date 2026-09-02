export type AuthorProfileLink = {
  href: string;
  label: string;
};

export type AuthorWork = AuthorProfileLink & {
  title: string;
};

export type AuthorProfile = {
  affiliations: Array<{
    href: string;
    name: string;
    role: string;
  }>;
  aliases: string[];
  externalProfiles: AuthorProfileLink[];
  image: string;
  name: string;
  publications: AuthorWork[];
  slug: string;
  summary: string;
  talks: AuthorWork[];
};

export const AUTHOR_PROFILES: AuthorProfile[] = [
  {
    affiliations: [
      {
        href: "/#team",
        name: "Discourse Graphs",
        role: "Research",
      },
    ],
    aliases: ["Matt Akamatsu"],
    externalProfiles: [],
    image: "/team/matt.png",
    name: "Matthew Akamatsu",
    publications: [
      {
        href: "https://research.protocol.ai/blog/2023/discourse-graphs-and-the-future-of-science/",
        label: "Protocol Labs Research",
        title: "Discourse Graphs and the Future of Science",
      },
    ],
    slug: "matthew-akamatsu",
    summary: "Researcher on the Discourse Graphs team.",
    talks: [
      {
        href: "https://atmosphereconf-vods.wisp.place/videos/keynote-towards-modular-open-science",
        label: "Atmosphere Conference",
        title: "Keynote: Towards Modular Open Science",
      },
      {
        href: "https://www.youtube-nocookie.com/embed/JOn_dJ-g3vY",
        label: "HCIL Brown Bag Speaker Series",
        title: "HCIL Brown Bag Speaker Series: Matt Akamatsu",
      },
      {
        href: "https://www.youtube-nocookie.com/embed/Fm-lzNhVMKs",
        label: "Topos Institute",
        title: "Discourse Graphs: A New Model for Scientific Communication",
      },
      {
        href: "https://www.youtube-nocookie.com/embed/2xGQepp-f-8",
        label: "DeSci Denver 2024",
        title: "Open Sourcing Scientific Research with Lab Discourse Graphs",
      },
    ],
  },
  {
    affiliations: [
      {
        href: "/#team",
        name: "Discourse Graphs",
        role: "Research",
      },
    ],
    aliases: [],
    externalProfiles: [
      {
        href: "http://joelchan.me/",
        label: "Personal website",
      },
    ],
    image: "/team/joel.png",
    name: "Joel Chan",
    publications: [
      {
        href: "https://commonplace.knowledgefutures.org/pub/m76tk163/release/1",
        label: "Commonplace",
        title: "Sustainable authorship models for scholarly communication",
      },
    ],
    slug: "joel-chan",
    summary: "Researcher on the Discourse Graphs team.",
    talks: [
      {
        href: "https://www.youtube-nocookie.com/embed/53kLyq7PceQ",
        label: "Protocol Labs Research Seminar",
        title: "Accelerating Scientific Discovery with Discourse Graphs",
      },
    ],
  },
];

const AUTHOR_PROFILES_BY_SLUG = new Map(
  AUTHOR_PROFILES.map((profile) => [profile.slug, profile]),
);

const AUTHOR_PROFILES_BY_NAME = new Map(
  AUTHOR_PROFILES.flatMap((profile) =>
    [profile.name, ...profile.aliases].map(
      (name) => [name.toLowerCase(), profile] as const,
    ),
  ),
);

export const getAuthorProfileBySlug = (
  slug: string,
): AuthorProfile | undefined => AUTHOR_PROFILES_BY_SLUG.get(slug);

export const getAuthorProfileByName = (
  name: string,
): AuthorProfile | undefined =>
  AUTHOR_PROFILES_BY_NAME.get(name.trim().toLowerCase());
