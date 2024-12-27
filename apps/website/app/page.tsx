import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { ArrowBigDownDash, CircleGauge } from "lucide-react";
import { getLatestBlogs } from "./blog/readBlogs";

export default async function Home() {
  const blogs = await getLatestBlogs();
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-neutral-dark px-6 py-24 text-center">
        <Image
          src="/MATSU_lab_journal_club_graph_view.png"
          alt="Discourse Graph Network Visualization"
          fill
          priority
          className="object-cover opacity-20"
          quality={85}
        />
        <div className="relative z-10">
          <h2 className="mx-auto max-w-5xl text-2xl font-semibold text-white md:text-3xl lg:text-5xl">
            A tool and ecosystem for collaborative knowledge synthesis
          </h2>
        </div>
      </section>

      <main>
        <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
          {/* About */}
          <div className="space-y-12" id="about">
            {/* Information Model */}
            <section className="grid items-center gap-12 md:grid-cols-2">
              <div>
                <h3 className="mb-4 text-2xl font-bold text-primary">
                  Information Model
                </h3>
                <p className="mb-4 text-neutral-dark">
                  Discourse Graphs are an information model that enables
                  everyone to map their ideas and arguments in a modular,
                  composable graph format.
                </p>
              </div>
              <div>
                <Image
                  src="/section1.webp"
                  alt="Scientific infrastructure"
                  width={1555}
                  height={684}
                  className="rounded-lg"
                />
              </div>
            </section>
            <section className="grid items-center gap-12 md:grid-cols-2">
              <div className="order-1 md:order-2">
                <h3 className="mb-4 text-2xl font-bold text-primary">
                  Better Infra for Communication
                </h3>
                <p className="mb-4 text-neutral-dark">
                  Discourse Graphs allow researchers to{" "}
                  <span className="font-semibold">
                    break the scientific research process into its atomic
                    elements
                  </span>{" "}
                  in a way that can be shared, remixed, and updated.
                </p>
                <p className="mb-4 text-neutral-dark">
                  Distinguishing evidence (the empirical observation) from claim
                  (the proposed answer) leaves space for multiple
                  interpretations.
                </p>
              </div>
              <div className="order-2 md:order-1">
                <Image
                  src="/section2.webp"
                  alt="Synthesize and Update"
                  width={1682}
                  height={1020}
                  className="rounded-lg"
                />
              </div>
            </section>
            {/* Synthesize and Update */}
            <section className="grid items-center gap-12 md:grid-cols-2">
              <div>
                <h3 className="mb-4 text-2xl font-bold text-primary">
                  Synthesize and Update
                </h3>
                <p className="mb-4 text-neutral-dark">
                  Discourse Graphs enable researchers to exchange knowledge in a
                  form that makes it straightforward to construct, update, and
                  find.
                </p>
                <p className="mb-4 text-neutral-dark">
                  Like Lego™️ bricks, the modular components of the Discourse
                  Graphs data model make it easy to choose which parts of a
                  scientific project you wish to share and build upon.
                </p>
              </div>
              <div>
                <Image
                  src="/section3.webp"
                  alt="Liberate your findings"
                  width={600}
                  height={800}
                  className="rounded-lg"
                  loading="lazy"
                />
              </div>
            </section>
            {/* Liberate your Findings */}
            <section className="grid items-center gap-12 md:grid-cols-2">
              <div className="order-1 md:order-2">
                <h3 className="mb-4 text-2xl font-bold text-primary">
                  Liberate your Findings
                </h3>
                <p className="mb-4 text-neutral-dark">
                  Rather than being organized hierarchically, Discourse Graphs
                  adopt a{" "}
                  <span className="font-semibold">grassroots organization</span>
                  , which better matches the
                  <span className="font-semibold">
                    {" "}
                    iterative and nonlinear process
                  </span>{" "}
                  of knowledge generation.
                </p>
                <p className="mb-4 text-neutral-dark">
                  The schema adds enough structure for you to revisit{" "}
                  <span className="font-semibold">"high signal" findings</span>{" "}
                  as{" "}
                  <span className="font-semibold">
                    "the minimal shareable insight"
                  </span>{" "}
                  for others to build on.
                </p>
                <p className="mb-4 text-neutral-dark">
                  As such, Discourse Graphs provide a{" "}
                  <span className="font-semibold">
                    needed coordination layer
                  </span>{" "}
                  for decentralized science.
                </p>
              </div>
              <div className="order-2 md:order-1">
                <Image
                  src="/section4.webp"
                  alt="Client-Agnostic & Researcher-aligned"
                  width={2056}
                  height={874}
                  className="rounded-lg"
                />
              </div>
            </section>
          </div>
          {/* Client-Agnostic & Researcher-Aligned */}
          <section className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-2xl font-bold text-primary">
                Client-Agnostic & Researcher-Aligned
              </h3>
              <p className="mb-4 text-neutral-dark">
                Discourse Graphs are a decentralized knowledge exchange protocol
                designed to be implemented and owned by researchers — rather
                than publishers — to share results at all stages of the
                scientific process.
              </p>
              <p className="mb-4 text-neutral-dark">
                Discourse Graphs are client-agnostic with decentralized
                push-pull storage & and can be implemented in any networked
                notebook software (
                <Link href="https://roamresearch.com/">Roam</Link>,{" "}
                <Link href="https://notion.so">Notion</Link>,{" "}
                <Link href="https://obsidian.md">Obsidian</Link>, etc.),
                allowing researchers to collaborate widely while using the tool
                of their choice.
              </p>
              <p className="mb-4 text-neutral-dark">
                Discourse Graphs support and incentivize knowledge sharing by
                making it easy to push to and pull from a shared knowledge graph
                — and to claim credit for many more types of contributions.
              </p>
              <p className="mb-4 font-bold text-secondary">
                Discourse Graphs are like GitHub for scientific communication.
              </p>
            </div>
            <Card className="rounded-lg bg-white/50 p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Image
                  src="/section5a.webp"
                  alt="Client-Agnostic & Researcher-Aligned"
                  width={400}
                  height={400}
                  className="h-52 w-auto rounded-lg object-contain"
                />
                <Image
                  src="/section5b.webp"
                  alt="Client-Agnostic & Researcher-Aligned"
                  width={400}
                  height={400}
                  className="h-52 w-auto rounded-lg object-contain"
                />
              </div>
            </Card>
          </section>
        </div>
        {/* The Natural OS for a Cloud Laboratory */}
        <section className="relative isolate overflow-hidden bg-white px-6 py-24 sm:py-32 lg:overflow-visible lg:px-0">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <svg
              aria-hidden="true"
              className="absolute left-[max(50%,25rem)] top-0 h-[64rem] w-[128rem] -translate-x-1/2 stroke-gray-200 [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)]"
            >
              <defs>
                <pattern
                  x="50%"
                  y={-1}
                  id="e813992c-7d03-4cc4-a2bd-151760b470a0"
                  width={200}
                  height={200}
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M100 200V.5M.5 .5H200" fill="none" />
                </pattern>
              </defs>
              <svg x="50%" y={-1} className="overflow-visible fill-gray-50">
                <path
                  d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z"
                  strokeWidth={0}
                />
              </svg>
              <rect
                fill="url(#e813992c-7d03-4cc4-a2bd-151760b470a0)"
                width="100%"
                height="100%"
                strokeWidth={0}
              />
            </svg>
          </div>
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:mx-0 lg:max-w-none lg:grid-cols-2 lg:items-start lg:gap-0">
            <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:grid-cols-2 lg:gap-x-8 lg:px-8">
              <div className="lg:pr-4">
                <div className="lg:max-w-lg">
                  <h2 className="mt-2 text-pretty text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
                    The Natural OS for a Cloud Laboratory
                  </h2>
                  <p className="mt-6 text-xl/8 text-gray-700">
                    The flexible Discourse Graph framework has been adapted to
                    coordinate and share active research, helping to lower the
                    barrier for interdisciplinary collaboration.
                  </p>
                </div>
              </div>
            </div>
            <div className="m-0 p-0 md:-ml-12 md:-mt-12 md:p-12 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:overflow-hidden">
              <Image
                src="/section6.webp"
                alt="Cloud Laboratory Workflow"
                width={1882}
                height={1918}
                className="w-full max-w-none rounded-xl bg-gray-900 shadow-xl ring-1 ring-gray-400/10 lg:w-[57rem]"
              />
              <p className="w-[48rem] max-w-none text-neutral-dark sm:w-[57rem]">
                Snapshot of <Link href="https://matsulab.com/">MATSU lab</Link>{" "}
                Discourse Graph
              </p>
            </div>
            <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:grid-cols-2 lg:gap-x-8 lg:px-8">
              <div className="lg:pr-4">
                <div className="max-w-xl text-base/7 text-gray-700 lg:max-w-lg">
                  <p className="text-xl">
                    Lab Discourse Graphs can be used to support
                  </p>
                  <ul role="list" className="mt-8 space-y-6 text-gray-600">
                    <li className="flex gap-x-3">
                      <span>
                        <strong className="font-semibold text-gray-900">
                          identifying gaps
                        </strong>{" "}
                        in knowledge and tractable "starter projects" for new
                        researchers
                      </span>
                    </li>
                    <li className="flex gap-x-3">
                      <span>
                        <strong className="font-semibold text-gray-900">
                          faster onboarding
                        </strong>{" "}
                        to existing research projects
                      </span>
                    </li>
                    <li className="flex gap-x-3">
                      <span>
                        <strong className="font-semibold text-gray-900">
                          grassroots generation
                        </strong>{" "}
                        of knowledge between researchers
                      </span>
                    </li>
                    <li className="flex gap-x-3">
                      <span>
                        <strong className="font-semibold text-gray-900">
                          modular communication
                        </strong>{" "}
                        and attribution of research findings
                      </span>
                    </li>
                  </ul>
                  <div className="mt-16 flex flex-col gap-4 lg:items-center">
                    <p className="flex items-center gap-4 text-xl text-neutral-dark sm:gap-2">
                      <ArrowBigDownDash className="min-w-6 border-2 border-primary text-primary" />
                      <span>
                        which leads to{" "}
                        <span className="font-bold text-secondary">
                          lower-friction collaboration
                        </span>
                      </span>
                    </p>
                    <p className="flex items-center gap-4 text-xl text-neutral-dark sm:gap-2">
                      <CircleGauge className="min-w-6 border-2 border-primary text-primary" />
                      <span>
                        and a{" "}
                        <span className="font-bold text-secondary">
                          faster discovery & innovation cycle
                        </span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
          {/* Resources */}
          <Card id="resources" className="rounded-xl bg-white/50 p-8 shadow-md">
            <CardHeader>
              <CardTitle className="mb-8 text-4xl font-bold text-primary">
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2">
                <li className="text-neutral-dark">
                  <Link href="https://research.protocol.ai/blog/2023/discourse-graphs-and-the-future-of-science/">
                    Discourse Graphs and the Future of Science
                  </Link>{" "}
                  by Matt Akamatsu and Evan Miyazono, in conversation with Tom
                  Kalil
                </li>
                <li className="text-neutral-dark">
                  <Link href="https://experiment.com/projects/sustainable-coordination-in-research-labs-via-graph-enabled-idea-boards/">
                    Project notes:
                  </Link>{" "}
                  Discourse Graphs for research lab coordination
                </li>
                <li className="text-neutral-dark">
                  <Link href="https://arxiv.org/html/2407.20666v2">
                    Preprint
                  </Link>{" "}
                  on discourse graph plugin design and use cases
                </li>
                <li className="text-neutral-dark">
                  <Link href="https://oasislab.pubpub.org/pub/54t0y9mk/release/3">
                    Knowledge synthesis: A conceptual model and practical guide
                  </Link>
                </li>
                <li className="text-neutral-dark">
                  Joel Chan on{" "}
                  <Link href="https://commonplace.knowledgefutures.org/pub/m76tk163/release/1">
                    Sustainable Authorship Models for a Discourse-Based
                    Scholarly Communication Infrastructure
                  </Link>
                </li>
                <li className="text-neutral-dark">
                  <Link href="https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension">
                    Discourse Graph plugin documentation
                  </Link>{" "}
                  for Roam Research
                </li>
                <li className="text-neutral-dark">
                  Roam Research{" "}
                  <Link href="https://roamresearch.com/#/app/DiscourseGraphTemplate/page/ChgjmeLuR">
                    Discourse Graph Template
                  </Link>{" "}
                  - get cracking building your graphs!
                </li>
              </ul>
            </CardContent>
          </Card>
          {/* Events */}
          <Card id="events" className="rounded-xl bg-white/50 p-8 shadow-md">
            <CardHeader>
              <CardTitle className="mb-8 text-4xl font-bold text-primary">
                Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-xl font-semibold text-neutral-dark">
                    IOSP '25 Winter Workshop: Discourse Graphs
                  </h3>
                  <p className="mb-2 text-neutral-dark">
                    February 23-24, 2025 | Denver Museum of Nature and Science
                  </p>
                  <Link
                    href="https://iosp.io/schedule"
                    className="text-primary transition-colors hover:text-primary/80"
                  >
                    View full schedule →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Blog Section */}
          {blogs.length > 0 && (
            <Card id="updates" className="rounded-xl bg-white/50 p-8 shadow-md">
              <CardHeader>
                <CardTitle className="mb-8 text-4xl font-bold text-primary">
                  Latest Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <ul className="space-y-6">
                    {blogs.map((blog) => (
                      <li
                        key={blog.slug}
                        className="flex items-start justify-between border-b border-gray-200 pb-4 last:border-b-0"
                      >
                        <div className="w-4/5">
                          <Link
                            href={`/blog/${blog.slug}`}
                            className="block text-2xl font-semibold text-blue-600 hover:underline"
                          >
                            {blog.title}
                          </Link>
                          <p className="mt-2 text-sm italic text-gray-500">
                            {blog.date}
                          </p>
                        </div>
                        <div className="w-1/5 text-right text-gray-600">
                          by {blog.author}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 text-center">
                    <Link
                      href="/blog"
                      className="inline-block rounded-md bg-primary px-4 py-2 text-lg font-semibold text-white transition hover:text-white"
                    >
                      See All Updates →
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Talks */}
          <Card id="talks" className="rounded-xl bg-white/50 p-8 shadow-md">
            <CardHeader>
              <CardTitle className="mb-8 text-4xl font-bold text-primary">
                Talks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-4">
                  <div className="relative aspect-video">
                    <iframe
                      className="absolute inset-0 h-full w-full rounded-lg"
                      src="https://www.youtube-nocookie.com/embed/Fm-lzNhVMKs"
                      title="Discourse Graphs: A New Model for Scientific Communication"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-dark">
                    Discourse Graphs: A New Model for Scientific Communication
                  </h3>
                  <p className="text-neutral-dark">
                    Matt Akamatsu, Topos Institute
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative aspect-video">
                    <iframe
                      className="absolute inset-0 h-full w-full rounded-lg"
                      src="https://www.youtube-nocookie.com/embed/2xGQepp-f-8"
                      title="Open Sourcing Scientific Research with Lab Discourse Graphs"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-dark">
                    Open Sourcing Scientific Research with Lab Discourse Graphs
                  </h3>
                  <p className="text-neutral-dark">
                    Matt Akamatsu, Desci Denver 2024
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative aspect-video">
                    <iframe
                      className="absolute inset-0 h-full w-full rounded-lg"
                      src="https://www.youtube-nocookie.com/embed/53kLyq7PceQ"
                      title="Accelerating Scientific Discovery with Discourse Graphs"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-dark">
                    Accelerating Scientific Discovery with Discourse Graphs
                  </h3>
                  <p className="text-neutral-dark">
                    Joel Chan, Protocol Labs Research Seminar
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative aspect-video">
                    <iframe
                      className="absolute inset-0 h-full w-full rounded-lg"
                      src="https://www.youtube-nocookie.com/embed/P0KUt2yrUkw"
                      title="Research roadmapping with Discourse Graphs"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-dark">
                    Research roadmapping with Discourse Graphs
                  </h3>
                  <p className="text-neutral-dark">
                    Karola Kirsanow, NYC Protocol Labs Research Seminar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Supporters */}
          <Card
            id="supporters"
            className="rounded-xl bg-white/50 p-8 shadow-md"
          >
            <CardHeader>
              <CardTitle className="mb-8 text-4xl font-bold text-primary">
                Supporters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto grid max-w-[800px] grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                  href="https://research.protocol.ai/"
                  className="mx-auto flex h-[88px] w-[200px] items-center justify-center transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/supporter-logos/PL_Research.svg"
                    alt="Protocol Labs Research"
                    width={406}
                    height={176}
                    className="h-full w-full object-contain"
                  />
                </Link>
                <Link
                  href="https://cziscience.medium.com/request-for-information-pathways-to-ai-enabled-research-55c52124def4"
                  className="mx-auto flex h-[88px] w-[160px] items-center justify-center transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/supporter-logos/Chan_Zuckerberg_Initiative.svg"
                    alt="Chan Zuckerberg Initiative"
                    width={112}
                    height={62}
                    className="h-full w-full object-contain"
                  />
                </Link>
                <Link
                  href="https://www.metagov.org/"
                  className="mx-auto flex h-[88px] w-[160px] items-center justify-center gap-4 transition-opacity hover:text-[rgb(0,204,153)] hover:opacity-80"
                >
                  <div className="h-[42px] w-[42px] flex-shrink-0">
                    <Image
                      src="/supporter-logos/Metagov.svg"
                      alt="Metagov"
                      width={42}
                      height={42}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <span className="text-[rgb(0,204,153)]">Metagov</span>
                </Link>
                <Link
                  href="https://experiment.com/grants/metascience"
                  className="mx-auto flex h-[88px] w-[200px] items-center justify-center transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/supporter-logos/Schmidt_Futures.svg"
                    alt="Schmidt Futures"
                    width={267}
                    height={20}
                    className="h-full w-full object-contain"
                  />
                </Link>
                <Link
                  href="https://commons.datacite.org/doi.org/10.71707/cx83-dh41"
                  className="mx-auto flex h-[88px] w-[200px] items-center justify-center transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/supporter-logos/The_Navigation_Fund.svg"
                    alt="The Navigation Fund"
                    width={546}
                    height={262}
                    className="h-full w-full object-contain"
                  />
                </Link>
              </div>
            </CardContent>
          </Card>
          {/* Contact */}
          <Card id="contact" className="rounded-xl bg-white/50 p-8 shadow-md">
            <CardHeader>
              <CardTitle className="mb-8 text-4xl font-bold text-primary">
                Ecosystem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-neutral-dark">
                  Are you interested in generating grassroots knowledge with
                  Discourse Graphs?{" "}
                  <span className="font-bold">Get Involved! 🚀</span>
                </p>
                <p className="text-neutral-dark">
                  We're building user-friendly Discourse Graph plugins in your
                  favorite Tool for Thought and would love to hear from you.
                </p>
                <p className="text-neutral-dark">
                  <Link href="mailto:discoursegraphs@protocol.ai">
                    Send us a line
                  </Link>{" "}
                  if you're interested in helping to{" "}
                  <Link href="https://github.com/DiscourseGraphs">develop</Link>{" "}
                  or{" "}
                  <Link href="https://experiment.com/projects/sustainable-coordination-in-research-labs-via-graph-enabled-idea-boards/">
                    beta test
                  </Link>{" "}
                  these knowledge generation and synthesis tools.
                </p>
                <p className="text-neutral-dark">
                  And stay up to date by joining us on{" "}
                  <Link href="https://discord.gg/vq83RRk2tg">Discord 🗣️</Link>!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="mt-12 border-t border-neutral-light/10 bg-neutral-dark px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-secondary">© 2024 Discourse Graphs</p>
          <div className="flex items-center space-x-4">
            <Link
              href="https://github.com/DiscourseGraphs"
              aria-label="GitHub Repository"
            >
              <Image
                src="/github.svg"
                alt="GitHub"
                width={24}
                height={24}
                className="opacity-80 transition-opacity hover:opacity-100"
              />
            </Link>
            <Link href="https://discord.gg/vq83RRk2tg" aria-label="Discord">
              <Image
                src="/discord.svg"
                alt="Discord"
                width={24}
                height={24}
                className="opacity-80 transition-opacity hover:opacity-100"
              />
            </Link>
          </div>
          {/* <div className="flex space-x-4">
              <Link href="#" className="text-secondary hover:text-neutral-dark">
                Privacy Policy
              </Link>
              <Link href="#" className="text-secondary hover:text-neutral-dark">
                Terms of Service
              </Link>
            </div> */}
        </div>
      </footer>
    </div>
  );
}
