import type { ReactElement, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import {
  ArrowRight,
  BookOpen,
  CircleGauge,
  ExternalLink,
  GitBranch,
  Mail,
  MessageCircle,
  Network,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { getLatestBlogs } from "~/(home)/blog/readBlogs";
import { Logo } from "~/components/Logo";
import { PlatformBadge } from "~/components/PlatformBadge";
import { TeamPerson } from "~/components/TeamPerson";
import { TEAM_MEMBERS } from "~/data/constants";

const SLACK_URL =
  "https://join.slack.com/t/discoursegraphs/shared_invite/zt-37xklatti-cpEjgPQC0YyKYQWPNgAkEg";

const FEATURE_CARDS = [
  {
    alt: "Structured scientific infrastructure diagram",
    description:
      "Map claims, evidence, questions, and projects as modular pieces that can be reused across people, tools, and contexts.",
    image: "/section1.webp",
    title: "Make research ideas composable",
  },
  {
    alt: "Discourse graph coordination layer",
    description:
      "Turn high-signal findings into shareable graph objects that support attribution, reuse, and decentralized collaboration.",
    image: "/section4.webp",
    title: "Liberate findings from static files",
  },
  {
    alt: "Shareable findings workflow",
    description:
      "Exchange work in a form that is easier to find, update, and build on than documents locked into one hierarchy.",
    image: "/section3.webp",
    title: "Synthesize and update continuously",
  },
  {
    alt: "Knowledge synthesis workflow",
    description:
      "Separate observations from interpretations so researchers can compare, remix, and update shared knowledge without flattening disagreement.",
    image: "/section2.webp",
    title: "Communicate with better structure",
  },
];

const LAB_BENEFITS = [
  "Identify knowledge gaps and starter projects for new researchers",
  "Onboard collaborators into active research faster",
  "Support grassroots knowledge generation between researchers",
  "Share modular research findings with clearer attribution",
];

const RESOURCE_LINKS = [
  {
    href: "https://research.protocol.ai/blog/2023/discourse-graphs-and-the-future-of-science/",
    meta: "Matt Akamatsu and Evan Miyazono, in conversation with Tom Kalil",
    title: "Discourse Graphs and the Future of Science",
  },
  {
    href: "https://experiment.com/projects/sustainable-coordination-in-research-labs-via-graph-enabled-idea-boards/",
    meta: "Project notes",
    title: "Discourse Graphs for research lab coordination",
  },
  {
    href: "https://arxiv.org/html/2407.20666v2",
    meta: "Preprint",
    title: "Discourse graph plugin design and use cases",
  },
  {
    href: "https://oasislab.pubpub.org/pub/54t0y9mk/release/3",
    meta: "Conceptual model and practical guide",
    title: "Knowledge synthesis",
  },
  {
    href: "https://commonplace.knowledgefutures.org/pub/m76tk163/release/1",
    meta: "Joel Chan",
    title: "Sustainable authorship models for scholarly communication",
  },
] as const;

const EVENTS = [
  {
    href: "https://discoursegraphs.github.io/panel-qa-site/",
    linkText: "View panel notes",
    meta: "June 18, 2026 | Zoom",
    title: "Frontiers in Research: Open Science Catalyze Panel",
  },
  {
    href: "https://bsky.app/profile/atproto.science/post/3mh6kak5agk2z",
    linkText: "View event post",
    meta: "March 27, 2026 | ATScience Conference, Vancouver",
    title: "Toward Modular Open Science",
  },
  {
    href: "https://www.mcgill.ca/qls/channels/event/qls-seminar-series-matthew-akamatsu-371875",
    linkText: "View seminar details",
    meta: "March 24, 2026 | Montreal",
    title: "Seminar: McGill University Quantitative Life Sciences program",
  },
  {
    href: "https://luma.com/jijn0d5k",
    linkText: "View talk page",
    meta: "November 19, 2025 | Zoom",
    title:
      "Metagov x Future of Science Seminar: Interoperable LLM- and human-centered research with Discourse Graphs",
  },
  {
    href: "https://iosp.io/schedule",
    linkText: "View full schedule",
    meta: "February 23-24, 2025 | Denver Museum of Nature and Science",
    title: "IOSP '25 Winter Workshop: Discourse Graphs",
  },
] as const;

type Talk =
  | {
      embedUrl: string;
      kind: "embed";
      speakers: string;
      title: string;
    }
  | {
      externalHref: string;
      kind: "external";
      speakers: string;
      title: string;
    };

const TALKS: Talk[] = [
  {
    externalHref:
      "https://atmosphereconf-vods.wisp.place/videos/keynote-towards-modular-open-science",
    kind: "external",
    speakers: "Rowan Cockett, Matt Akamatsu",
    title: "Keynote: Towards Modular Open Science",
  },
  {
    embedUrl: "https://www.youtube-nocookie.com/embed/JOn_dJ-g3vY",
    kind: "embed",
    speakers: "Matt Akamatsu",
    title: "HCIL Brown Bag Speaker Series: Matt Akamatsu",
  },
  {
    embedUrl: "https://www.youtube-nocookie.com/embed/Fm-lzNhVMKs",
    kind: "embed",
    speakers: "Matt Akamatsu, Topos Institute",
    title: "Discourse Graphs: A New Model for Scientific Communication",
  },
  {
    embedUrl: "https://www.youtube-nocookie.com/embed/2xGQepp-f-8",
    kind: "embed",
    speakers: "Matt Akamatsu, Desci Denver 2024",
    title: "Open Sourcing Scientific Research with Lab Discourse Graphs",
  },
  {
    embedUrl: "https://www.youtube-nocookie.com/embed/53kLyq7PceQ",
    kind: "embed",
    speakers: "Joel Chan, Protocol Labs Research Seminar",
    title: "Accelerating Scientific Discovery with Discourse Graphs",
  },
  {
    embedUrl: "https://www.youtube-nocookie.com/embed/P0KUt2yrUkw",
    kind: "embed",
    speakers: "Karola Kirsanow, NYC Protocol Labs Research Seminar",
    title: "Research roadmapping with Discourse Graphs",
  },
];

type Supporter = {
  alt: string;
  height: number;
  href: string;
  image: string;
  label?: string;
  width: number;
};

const SUPPORTERS: Supporter[] = [
  {
    alt: "Protocol Labs Research",
    href: "https://research.protocol.ai/",
    image: "/supporter-logos/PL_Research.svg",
    width: 406,
    height: 176,
  },
  {
    alt: "Chan Zuckerberg Initiative",
    href: "https://cziscience.medium.com/request-for-information-pathways-to-ai-enabled-research-55c52124def4",
    image: "/supporter-logos/Chan_Zuckerberg_Initiative.svg",
    width: 112,
    height: 62,
  },
  {
    alt: "Metagov",
    href: "https://www.metagov.org/",
    image: "/supporter-logos/Metagov.svg",
    width: 42,
    height: 42,
    label: "Metagov",
  },
  {
    alt: "Schmidt Futures",
    href: "https://experiment.com/grants/metascience",
    image: "/supporter-logos/Schmidt_Futures.svg",
    width: 267,
    height: 20,
  },
  {
    alt: "The Navigation Fund",
    href: "https://commons.datacite.org/doi.org/10.71707/cx83-dh41",
    image: "/supporter-logos/The_Navigation_Fund.svg",
    width: 546,
    height: 262,
  },
];

type SectionHeaderProps = {
  description?: string;
  eyebrow: string;
  isWide?: boolean;
  title: string;
};

const SectionHeader = ({
  description,
  eyebrow,
  isWide = false,
  title,
}: SectionHeaderProps): ReactElement => (
  <div className={isWide ? "max-w-none md:flex-1" : "max-w-3xl"}>
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
      {eyebrow}
    </p>
    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
      {title}
    </h2>
    {description && (
      <p className="mt-4 text-lg leading-8 text-neutral-dark/75">
        {description}
      </p>
    )}
  </div>
);

const ArrowLink = ({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}): ReactElement => (
  <Link
    href={href}
    className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-secondary/70"
  >
    {children}
    <ArrowRight className="h-4 w-4" aria-hidden="true" />
  </Link>
);

const Home = async (): Promise<ReactElement> => {
  const blogs = await getLatestBlogs();

  return (
    <div>
      <section className="relative isolate flex min-h-[72svh] items-center overflow-hidden bg-neutral-dark px-5 py-16 text-white sm:px-6 lg:py-20">
        <Image
          src="/MATSU_lab_journal_club_graph_view.png"
          alt="Discourse Graph network visualization"
          fill
          priority
          className="object-cover opacity-25"
          quality={90}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-neutral-dark/70" />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-md border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              Open infrastructure for collaborative knowledge synthesis
            </p>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Discourse Graphs
            </h1>
            <p className="text-white/82 mt-6 max-w-2xl text-xl leading-8">
              A tool and ecosystem for turning research claims, evidence, and
              questions into modular graphs that teams can share, update, and
              build on.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {/* Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/docs"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 hover:text-white"
              >
                Open docs
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                href="/#plugins"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/35 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 hover:text-white"
              >
                Explore plugins
                <Puzzle className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={SLACK_URL}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-5 py-3 text-sm font-semibold text-white/90 transition-colors hover:border-secondary hover:text-white"
              >
                Join Slack
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              ["Protocol", "Client-agnostic model for structured research"],
              ["Plugins", "Roam Research and Obsidian workflows"],
              ["Community", "Researchers building shared graph practices"],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur"
              >
                <p className="text-sm font-semibold text-primary">{title}</p>
                <p className="text-white/78 mt-2 text-sm leading-6">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="flex-1">
        <section className="px-5 py-16 sm:px-6 lg:py-24">
          <div id="about" className="mx-auto max-w-7xl scroll-mt-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <SectionHeader
                eyebrow="About"
                title="A shared structure for research work in motion"
                description="Discourse Graphs help teams move beyond static documents by representing research as connected claims, evidence, questions, and projects."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="h-full rounded-lg border-neutral-dark/10 bg-white shadow-sm">
                  <CardContent className="flex h-full min-h-28 items-center gap-4 p-6">
                    <Network
                      className="h-6 w-6 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-6 text-neutral-dark/75">
                      Compose work into a graph that can be queried, remixed,
                      and carried across tools.
                    </p>
                  </CardContent>
                </Card>
                <Card className="h-full rounded-lg border-neutral-dark/10 bg-white shadow-sm">
                  <CardContent className="flex h-full min-h-28 items-center gap-4 p-6">
                    <Sparkles
                      className="h-6 w-6 shrink-0 text-secondary"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-6 text-neutral-dark/75">
                      Keep findings live as teams interpret evidence and update
                      their models.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {FEATURE_CARDS.map((feature) => (
                <Card
                  key={feature.title}
                  className="overflow-hidden rounded-lg border-neutral-dark/10 bg-white shadow-sm"
                >
                  <div className="relative aspect-[16/9] bg-neutral-light">
                    <Image
                      src={feature.image}
                      alt={feature.alt}
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-neutral-dark">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-base leading-7 text-neutral-dark/75">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-16 grid gap-8 border-t border-neutral-dark/10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
                  Tool choice
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-tight text-primary">
                  Client-agnostic and researcher-aligned
                </h3>
                <div className="mt-5 space-y-4 text-base leading-7 text-neutral-dark/75">
                  <p>
                    Discourse Graphs are a decentralized knowledge exchange
                    protocol designed to be implemented and owned by researchers
                    rather than publishers.
                  </p>
                  <p>
                    The model can be implemented in networked notebook software
                    like{" "}
                    <Link href="https://roamresearch.com/">Roam Research</Link>,{" "}
                    <Link href="https://obsidian.md">Obsidian</Link>, and other
                    tools researchers already use.
                  </p>
                  <p className="font-semibold text-secondary">
                    Discourse Graphs are like GitHub for scientific
                    communication.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-neutral-dark/10 bg-white p-4">
                  <Image
                    src="/section5a.webp"
                    alt="Client-agnostic discourse graph workflow"
                    fill
                    className="object-contain p-6"
                    sizes="(min-width: 640px) 50vw, 100vw"
                  />
                </div>
                <div className="relative aspect-square overflow-hidden rounded-lg border border-neutral-dark/10 bg-white p-4">
                  <Image
                    src="/section5b.webp"
                    alt="Researcher-aligned discourse graph workflow"
                    fill
                    className="object-contain p-6"
                    sizes="(min-width: 640px) 50vw, 100vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-16 sm:px-6 lg:py-24">
          <div id="plugins" className="mx-auto max-w-7xl scroll-mt-20">
            <SectionHeader
              eyebrow="Plugins"
              isWide
              title="Start from the tool you already use"
              description="The project maintains plugin workflows for Roam Research and Obsidian, with docs for installation, graph building, querying, and configuration."
            />

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {[
                {
                  docsHref: "/docs/roam/",
                  githubHref:
                    "https://github.com/DiscourseGraphs/discourse-graph/tree/main/apps/roam",
                  meta: "Available via Roam Depot",
                  platform: "roam" as const,
                  title: "Roam Research plugin",
                },
                {
                  docsHref: "/docs/obsidian/",
                  githubHref:
                    "https://github.com/DiscourseGraphs/discourse-graph-obsidian",
                  meta: "Available via BRAT",
                  platform: "obsidian" as const,
                  title: "Obsidian plugin",
                },
              ].map((plugin) => (
                <Card
                  key={plugin.title}
                  className="rounded-lg border-neutral-dark/10 bg-neutral-light shadow-sm"
                >
                  <CardContent className="flex h-full flex-col gap-8 p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <PlatformBadge platform={plugin.platform} />
                      <Puzzle
                        className="h-6 w-6 text-neutral-dark/35"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold text-primary">
                        {plugin.title}
                      </h3>
                      <p className="mt-3 text-base leading-7 text-neutral-dark/75">
                        {plugin.meta}. Use the docs to set up the plugin and
                        learn the core discourse graph workflows.
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-3">
                      {/* Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS. */}
                      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                      <a
                        href={plugin.docsHref}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 hover:text-white"
                      >
                        Read docs
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                      </a>
                      <Link
                        href={plugin.githubHref}
                        className="inline-flex items-center gap-2 rounded-md border border-neutral-dark/15 px-4 py-2 text-sm font-semibold text-neutral-dark transition-colors hover:border-secondary hover:text-secondary"
                      >
                        View source
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden px-5 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <SectionHeader
                eyebrow="Cloud laboratory"
                title="A natural operating layer for active research"
                description="The flexible framework has been adapted to coordinate and share active research, lowering the barrier for interdisciplinary collaboration."
              />
              <ul className="mt-8 space-y-4">
                {LAB_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex gap-3">
                    <GitBranch
                      className="mt-1 h-5 w-5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span className="text-base leading-7 text-neutral-dark/75">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="flex min-h-24 items-center justify-center rounded-lg border border-primary/25 bg-white p-6">
                  <p className="flex flex-col items-center justify-center gap-2 text-center text-sm font-semibold text-neutral-dark">
                    <MessageCircle
                      className="h-5 w-5 text-primary"
                      aria-hidden="true"
                    />
                    Lower-friction collaboration
                  </p>
                </div>
                <div className="flex min-h-24 items-center justify-center rounded-lg border border-secondary/25 bg-white p-6">
                  <p className="flex flex-col items-center justify-center gap-2 text-center text-sm font-semibold text-neutral-dark">
                    <CircleGauge
                      className="h-5 w-5 text-secondary"
                      aria-hidden="true"
                    />
                    Faster discovery cycles
                  </p>
                </div>
              </div>
            </div>

            <figure>
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-neutral-dark/10 bg-white shadow-sm">
                <Image
                  src="/section6.webp"
                  alt="MATSU lab Discourse Graph snapshot"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 58vw, 100vw"
                />
              </div>
              <figcaption className="mt-3 text-sm text-neutral-dark/65">
                Snapshot of <Link href="https://matsulab.com/">MATSU lab</Link>{" "}
                Discourse Graph
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="bg-white px-5 py-16 sm:px-6 lg:py-24">
          <div id="resources" className="mx-auto max-w-7xl scroll-mt-20">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionHeader
                eyebrow="Resources"
                isWide
                title="Read the ideas behind the project"
                description="A short set of writing and project notes for understanding discourse graphs as research infrastructure."
              />
              <ArrowLink href="/#plugins">Explore plugins</ArrowLink>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {RESOURCE_LINKS.map((resource) => (
                <Link
                  key={resource.href}
                  href={resource.href}
                  className="group rounded-lg border border-neutral-dark/10 bg-neutral-light p-5 transition-colors hover:border-secondary"
                >
                  <p className="text-sm font-semibold text-secondary">
                    {resource.meta}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-neutral-dark">
                    {resource.title}
                  </h3>
                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    Open resource
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6 lg:py-24">
          <div id="events" className="mx-auto max-w-7xl scroll-mt-20">
            <SectionHeader
              eyebrow="Events"
              isWide
              title="Recent talks, panels, and workshops"
              description="Places where the team and collaborators have presented the Discourse Graphs model and project."
            />
            <div className="mt-10 divide-y divide-neutral-dark/10 border-y border-neutral-dark/10">
              {EVENTS.map((event) => (
                <article
                  key={event.href}
                  className="grid gap-4 py-6 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-dark">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-dark/65">
                      {event.meta}
                    </p>
                  </div>
                  <Link
                    href={event.href}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-secondary/70"
                  >
                    {event.linkText}
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {blogs.length > 0 && (
          <section className="bg-white px-5 py-16 sm:px-6 lg:py-24">
            <div id="updates" className="mx-auto max-w-7xl scroll-mt-20">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <SectionHeader
                  eyebrow="Updates"
                  isWide
                  title="Latest project updates"
                  description="Recent posts from the Discourse Graphs team."
                />
                <ArrowLink href="/blog">See all updates</ArrowLink>
              </div>
              <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {blogs.map((blog) => (
                  <Card
                    key={blog.slug}
                    className="rounded-lg border-neutral-dark/10 bg-neutral-light shadow-sm"
                  >
                    <CardContent className="flex h-full flex-col p-6">
                      <p className="text-sm text-neutral-dark/60">
                        {blog.date}
                      </p>
                      <Link
                        href={`/blog/${blog.slug}`}
                        className="mt-4 text-xl font-semibold text-neutral-dark transition-colors hover:text-secondary"
                      >
                        {blog.title}
                      </Link>
                      <p className="mt-6 text-sm text-neutral-dark/60">
                        By {blog.author}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="px-5 py-16 sm:px-6 lg:py-24">
          <div id="talks" className="mx-auto max-w-7xl scroll-mt-20">
            <SectionHeader
              eyebrow="Talks"
              isWide
              title="Watch the model explained"
              description="Videos and recordings that introduce the motivation, use cases, and research workflows behind Discourse Graphs."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {TALKS.map((talk) => (
                <article key={talk.title} className="space-y-4">
                  {talk.kind === "embed" ? (
                    <div className="relative aspect-video overflow-hidden rounded-lg border border-neutral-dark/10 bg-white shadow-sm">
                      <iframe
                        className="absolute inset-0 h-full w-full"
                        src={talk.embedUrl}
                        title={talk.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <Link
                      href={talk.externalHref}
                      className="flex aspect-video items-center justify-center rounded-lg border border-neutral-dark/10 bg-neutral-dark p-6 text-center text-white shadow-sm transition-colors hover:bg-neutral-dark/90 hover:text-white"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold">
                        Watch talk
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </Link>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-dark">
                      {talk.title}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-dark/65">
                      {talk.speakers}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-16 sm:px-6 lg:py-24">
          <div id="team" className="mx-auto max-w-7xl scroll-mt-20">
            <SectionHeader
              eyebrow="Team"
              isWide
              title="Built by researchers, designers, and engineers"
              description="The project brings together research infrastructure, knowledge synthesis, and tool-building experience."
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM_MEMBERS.map((member) => (
                <div
                  key={member.name}
                  className="rounded-lg border border-neutral-dark/10 bg-neutral-light p-6"
                >
                  <TeamPerson member={member} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6 lg:py-24">
          <div id="supporters" className="mx-auto max-w-7xl scroll-mt-20">
            <SectionHeader
              eyebrow="Supporters"
              isWide
              title="Supported by open science funders and partners"
              description="Organizations helping make modular, reusable scientific communication possible."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {SUPPORTERS.map((supporter) => (
                <Link
                  key={supporter.href}
                  href={supporter.href}
                  className="flex h-32 items-center justify-center gap-3 rounded-lg border border-neutral-dark/10 bg-white p-6 transition-colors hover:border-secondary"
                >
                  <Image
                    src={supporter.image}
                    alt={supporter.alt}
                    width={supporter.width}
                    height={supporter.height}
                    className="max-h-16 w-auto object-contain"
                  />
                  {supporter.label && (
                    <span className="text-[rgb(0,204,153)]">
                      {supporter.label}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-neutral-dark px-5 pb-48 pt-16 text-white sm:px-6 lg:pb-56 lg:pt-24">
          <div
            id="contact"
            className="mx-auto grid max-w-7xl scroll-mt-20 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Contact
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Help build better infrastructure for collaborative research
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/75">
                We are building user-friendly Discourse Graph plugins in tools
                for thought and would like to hear from researchers, developers,
                labs, and funders.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="mailto:discoursegraphs@homeworld.bio"
                className="rounded-lg border border-white/15 bg-white/10 p-5 transition-colors hover:border-primary hover:text-white"
              >
                <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="mt-4 font-semibold">Send us a line</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Talk with us about development, pilots, and collaborations.
                </p>
              </Link>
              <Link
                href={SLACK_URL}
                className="rounded-lg border border-white/15 bg-white/10 p-5 transition-colors hover:border-secondary hover:text-white"
              >
                <MessageCircle
                  className="h-6 w-6 text-secondary"
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-semibold">Join Slack</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Follow project updates and talk with the community.
                </p>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-neutral-dark px-5 py-10 text-white sm:px-6">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 md:grid-cols-[1fr_0.7fr_1.1fr] md:items-start">
          <div className="flex flex-col gap-3">
            <Logo textClassName="text-white" linked={false} />
            <p className="text-sm text-white/55">
              Copyright 2024-{new Date().getFullYear()} Homeworld Collective
            </p>
          </div>

          <div className="grid gap-2 text-sm">
            <Link
              href="https://github.com/DiscourseGraphs"
              className="text-white/70 transition-colors hover:text-primary"
            >
              GitHub
            </Link>
            <Link
              href="https://www.youtube.com/@discoursegraphs"
              className="text-white/70 transition-colors hover:text-primary"
            >
              YouTube
            </Link>
            <Link
              href={SLACK_URL}
              className="text-white/70 transition-colors hover:text-primary"
            >
              Slack
            </Link>
            <Link
              href="https://bsky.app/profile/discoursegraphs.bsky.social"
              className="text-white/70 transition-colors hover:text-primary"
            >
              Bluesky
            </Link>
          </div>

          <div className="rounded-lg border border-white/15 p-5">
            <h3 className="text-lg font-semibold text-white">
              Stay up to date
            </h3>
            <p className="mt-1 text-sm text-white/65">
              Periodic news and info about the Discourse Graphs project.
            </p>

            <form
              action="https://buttondown.com/api/emails/embed-subscribe/DiscourseGraphs"
              method="post"
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <input type="hidden" name="embed" value="1" />
              <input
                type="email"
                name="email"
                id="bd-email"
                placeholder="your@email.com"
                required
                className="min-w-0 flex-1 rounded-md border border-white/20 bg-neutral-dark px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
              />
              <button
                type="submit"
                className="rounded-md border border-white px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-neutral-dark"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
