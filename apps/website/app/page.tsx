import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <div
      className={`min-h-screen bg-neutral-light scroll-smooth ${inter.className}`}
    >
      <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 space-y-4 md:space-y-0">
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
          <ul className="flex flex-wrap justify-center md:flex-nowrap space-x-4 md:space-x-8">
            {["About", "Resources", "Talks", "Supporters", "Contact"].map(
              (item) => (
                <li key={item}>
                  <Link
                    href={`#${item.toLowerCase()}`}
                    className="text-neutral-dark hover:text-neutral-dark/60"
                  >
                    {item}
                  </Link>
                </li>
              )
            )}
          </ul>
        </nav>
      </header>

      <section className="relative bg-neutral-dark text-center py-24 px-6 overflow-hidden">
        <Image
          src="/MATSU_lab_journal_club_graph_view.png"
          alt="Discourse Graph Network Visualization"
          fill
          priority
          className="object-cover opacity-20"
          quality={85}
        />
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl lg:text-5xl font-semibold max-w-5xl mx-auto text-white">
            A tool and ecosystem for collaborative knowledge synthesis
          </h2>
        </div>
      </section>

      <main className="space-y-12 px-6 py-12 max-w-6xl mx-auto">
        <div className="space-y-12" id="about">
          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-primary mb-4">
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
          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-1 md:order-2">
              <h3 className="text-2xl font-bold text-primary mb-4">
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

          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-primary mb-4">
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

          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-1 md:order-2">
              <h3 className="text-2xl font-bold text-primary mb-4">
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

          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-primary mb-4">
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
            <div className="flex flex-col items-center justify-center space-y-4">
              <Image
                src="/section5a.webp"
                alt="Client-Agnostic & Researcher-Aligned"
                width={400}
                height={400}
                className="rounded-lg object-contain h-52 w-auto" // h-24 = 96px
              />
              <Image
                src="/section5b.webp"
                alt="Client-Agnostic & Researcher-Aligned"
                width={400}
                height={400}
                className="rounded-lg object-contain h-52 w-auto" // h-24 = 96px
              />
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-1 md:order-2">
              <h3 className="text-2xl font-bold text-primary mb-4">
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
              <ul className="list-disc list-inside mb-4 space-y-2">
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
                className="rounded-lg mx-auto"
              />
              <p className="text-neutral-dark text-right">
                Snapshot of <Link href="https://matsulab.com/">MATSU lab</Link>{" "}
                Discourse Graph
              </p>
            </div>
          </section>
        </div>
        <div id="resources" className="space-y-12">
          <section className="bg-white/50 rounded-xl p-8 shadow-sm">
            <h2 className="text-4xl font-bold text-primary mb-8">Resources</h2>
            <ul className="list-disc list-inside space-y-2">
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
          </section>

          <section className="bg-white/50 rounded-xl p-8 shadow-sm">
            <h2 className="text-4xl font-bold text-primary mb-8">
              Future Events
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-neutral-dark mb-2">
                  IOSP '25 Winter Workshop: Discourse Graphs
                </h3>
                <p className="text-neutral-dark mb-2">
                  February 23-24, 2025 | Denver Museum of Nature and Science
                </p>
                {/* <p className="text-neutral-dark mb-4">
                  Join us for a workshop on discourse graphs as part of the
                  Institute of Open Science Practices winter conference. The
                  workshop will explore experiences using discourse graph tools,
                  researcher data needs, and future developments in open science
                  infrastructure.
                </p> */}
                <Link
                  href="https://iosp.io/schedule"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  View full schedule →
                </Link>
              </div>
            </div>
          </section>
        </div>
        <div id="talks" className="space-y-12">
          <section className="bg-white/50 rounded-xl p-8 shadow-sm">
            <h2 className="text-4xl font-bold text-primary mb-8">Past Talks</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="relative aspect-video">
                  <iframe
                    className="absolute inset-0 w-full h-full rounded-lg"
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
                    className="absolute inset-0 w-full h-full rounded-lg"
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
                    className="absolute inset-0 w-full h-full rounded-lg"
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
                    className="absolute inset-0 w-full h-full rounded-lg"
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
          </section>
        </div>
        <div id="supporters" className="space-y-12">
          <section className="bg-white/50 rounded-xl p-8 shadow-sm">
            <h2 className="text-4xl font-bold text-primary mb-8">Supporters</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-[800px] mx-auto">
              <Link
                href="https://research.protocol.ai/"
                className="hover:opacity-80 transition-opacity w-[200px] h-[88px] flex items-center justify-center mx-auto"
              >
                <Image
                  src="/supporter-logos/PL_Research.svg"
                  alt="Protocol Labs Research"
                  width={406}
                  height={176}
                  className="w-full h-full object-contain"
                />
              </Link>
              <Link
                href="https://cziscience.medium.com/request-for-information-pathways-to-ai-enabled-research-55c52124def4"
                className="hover:opacity-80 transition-opacity w-[160px] h-[88px] flex items-center justify-center mx-auto"
              >
                <Image
                  src="/supporter-logos/Chan_Zuckerberg_Initiative.svg"
                  alt="Chan Zuckerberg Initiative"
                  width={112}
                  height={62}
                  className="w-full h-full object-contain"
                />
              </Link>
              <Link
                href="https://www.metagov.org/"
                className="hover:opacity-80 hover:text-[rgb(0,204,153)] transition-opacity flex items-center justify-center mx-auto gap-4 w-[160px] h-[88px]"
              >
                <div className="h-[42px] w-[42px] flex-shrink-0">
                  <Image
                    src="/supporter-logos/Metagov.svg"
                    alt="Metagov"
                    width={42}
                    height={42}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[rgb(0,204,153)]">Metagov</span>
              </Link>
              <Link
                href="https://experiment.com/grants/metascience"
                className="hover:opacity-80 transition-opacity w-[200px] h-[88px] flex items-center justify-center mx-auto"
              >
                <Image
                  src="/supporter-logos/Schmidt_Futures.svg"
                  alt="Schmidt Futures"
                  width={267}
                  height={20}
                  className="w-full h-full object-contain"
                />
              </Link>
              <Link
                href="https://www.navigation.org/grants/open-science"
                className="hover:opacity-80 transition-opacity w-[200px] h-[88px] flex items-center justify-center mx-auto"
              >
                <Image
                  src="/supporter-logos/The_Navigation_Fund.svg"
                  alt="The Navigation Fund"
                  width={546}
                  height={262}
                  className="w-full h-full object-contain"
                />
              </Link>
            </div>
          </section>
        </div>
        <div id="contact" className="space-y-12">
          <section className="bg-white/50 rounded-xl p-8 shadow-sm">
            <h2 className="text-3xl font-bold text-primary mb-8">
              The Ecosystem
            </h2>
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
          </section>
        </div>
      </main>

      <footer className="bg-neutral-dark border-t border-neutral-light/10 mt-12 py-6 px-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <p className="text-secondary">© 2024 Discourse Graphs</p>
          <div className="flex space-x-4 items-center">
            <Link
              href="https://github.com/DiscourseGraphs"
              aria-label="GitHub Repository"
            >
              <Image
                src="/github.svg"
                alt="GitHub"
                width={24}
                height={24}
                className="opacity-80 hover:opacity-100 transition-opacity"
              />
            </Link>
            <Link href="https://discord.gg/vq83RRk2tg" aria-label="Discord">
              <Image
                src="/discord.svg"
                alt="Discord"
                width={24}
                height={24}
                className="opacity-80 hover:opacity-100 transition-opacity"
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
