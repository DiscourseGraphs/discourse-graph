import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <div className={`min-h-screen bg-neutral-light ${inter.className}`}>
      <header className="flex flex-col items-center justify-between space-y-4 px-6 py-4 md:flex-row md:space-y-0">
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo-screenshot-48.png"
            alt="Discourse Graphs Logo"
            width={48}
            height={48}
          />

          <span className="text-3xl font-bold text-neutral-dark">
            Discourse Graphs
          </span>
        </Link>
        <nav className="w-full md:w-auto">
          <ul className="flex flex-wrap justify-center space-x-4 md:flex-nowrap md:space-x-8">
            {[
              "About",
              "Resources",
              "Events",
              "Talks",
              "Supporters",
              "Contact",
            ].map((item) => (
              <li key={item}>
                <Link
                  href={`#${item.toLowerCase()}`}
                  className="text-neutral-dark hover:text-neutral-dark/60"
                >
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

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

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        {/* About */}
        <div className="space-y-12" id="about">
          <section className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-2xl font-bold text-primary">
                Information Model
              </h3>
              <p className="mb-4 text-neutral-dark">
                Discourse Graphs are an information model that enables everyone
                to map their ideas and arguments in a modular, composable graph
                format.
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
                Discourse Graphs allow researchers to break the scientific
                research process into its atomic elements in a way that can be
                shared, remixed, and updated.
              </p>
              <p className="mb-4 text-neutral-dark">
                Distinguishing evidence (the empirical observation) from claim
                (the proposed answer) leaves space for multiple interpretations.
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

          <section className="grid items-center gap-12 md:grid-cols-2">
            <div className="order-1 md:order-2">
              <h3 className="mb-4 text-2xl font-bold text-primary">
                Liberate your Findings
              </h3>
              <p className="mb-4 text-neutral-dark">
                Rather than being organized hierarchically, discourse graphs
                adopt a grassroots organization, which better matches the
                iterative and nonlinear process of knowledge generation.
              </p>
              <p className="mb-4 text-neutral-dark">
                The schema adds enough structure for you to revisit "high
                signal" findings as "the minimal shareable insight" for others
                to build on.
              </p>
              <p className="mb-4 text-neutral-dark">
                As such, discourse graphs provide a needed coordination layer
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
                notebook software (Roam, Notion, Obsidian, etc.), allowing
                researchers to collaborate widely while using the tool of their
                choice.
              </p>
              <p className="mb-4 text-neutral-dark">
                Discourse Graphs support and incentivize knowledge sharing by
                making it easy to push to and pull from a shared knowledge graph
                — and to claim credit for many more types of contributions.
              </p>
              <p className="mb-4 text-neutral-dark">
                Discourse Graphs are like github for scientific communication.
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

          <section className="grid items-center gap-12 md:grid-cols-2">
            <div className="order-1 md:order-2">
              <h3 className="mb-4 text-2xl font-bold text-primary">
                The Natural OS for a Cloud Laboratory
              </h3>
              <p className="mb-4 text-neutral-dark">
                The flexible Discourse Graph framework has been adapted to
                coordinate and share active research, helping to lower the
                barrier for interdisciplinary collaboration.
              </p>
              <p className="mb-4 text-neutral-dark">
                Lab Discourse Graphs can be used to support:
              </p>
              <ul className="mb-4 list-inside list-disc space-y-2">
                <li className="text-neutral-dark">
                  identifying gaps in knowledge and tractable "starter projects"
                  for new researchers
                </li>
                <li className="text-neutral-dark">
                  faster onboarding to existing research projects
                </li>
                <li className="text-neutral-dark">
                  grassroots generation of knowledge between researchers
                </li>
                <li className="text-neutral-dark">
                  modular communication and attribution of research findings
                </li>
              </ul>
              <div className="text-center">
                <p className="mb-4 text-neutral-dark">
                  ➡️ which leads to lower-friction collaboration
                </p>
                <p className="mb-4 text-neutral-dark">
                  ↪️ and a faster discovery & innovation cycle
                </p>
              </div>
            </div>
            <div className="order-2 md:order-1">
              <Image
                src="/section6.webp"
                alt="Cloud Laboratory Workflow"
                width={828}
                height={740}
                className="mx-auto rounded-lg"
              />
              <p className="text-right text-neutral-dark">
                Snapshot of <Link href="https://matsulab.com/">MATSU lab</Link>{" "}
                Discourse Graph
              </p>
            </div>
          </section>
        </div>

        {/* Resources */}
        <Card id="resources" className="rounded-xl bg-white/50 p-8 shadow-md">
          <CardHeader>
            <CardTitle className="mb-8 text-4xl font-bold text-primary">
              Resources
            </CardTitle>
          </CardHeader>

          {/* <h2 ></h2> */}

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
                discourse graphs for research lab coordination
              </li>
              <li className="text-neutral-dark">
                <Link href="https://arxiv.org/html/2407.20666v2">Preprint</Link>{" "}
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
                  Sustainable Authorship Models for a Discourse-Based Scholarly
                  Communication Infrastructure
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
                    title="Research roadmapping with discourse graphs"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <h3 className="text-xl font-semibold text-neutral-dark">
                  Research roadmapping with discourse graphs
                </h3>
                <p className="text-neutral-dark">
                  Karola Kirsanow, NYC Protocol Labs Research Seminar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supporters */}
        <Card id="supporters" className="rounded-xl bg-white/50 p-8 shadow-md">
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
                href="https://www.navigation.org/grants/open-science"
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
