import type { Metadata, ResolvingMetadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const title = "Database engineer | Discourse Graphs";
const description =
  "Join Discourse Graphs for a remote, three-month database engineering contract starting October 2026. Approximately 20 hours per week, $8k/month.";

export const generateMetadata = async (
  _props: unknown,
  parent?: ResolvingMetadata,
): Promise<Metadata> => {
  // Nextra's page map calls this without Next.js's parent metadata argument.
  const inherited = await parent;
  return {
    title,
    description,
    openGraph: { ...inherited?.openGraph, title, description },
    twitter: { ...inherited?.twitter, title, description },
  };
};

const CareersPage = (): ReactElement => (
  <main className="flex-1 px-5 py-16 sm:px-6 lg:py-24">
    <div className="mx-auto max-w-3xl">
      <Link
        href="/#team"
        className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-secondary/70"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Meet the team
      </Link>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
        Database engineer
      </h1>
      <p className="mt-4 text-lg font-semibold leading-8 text-neutral-dark/75">
        3-month contract · Remote · ~20 hrs/week · $8k/mo · Start October 2026
      </p>
      <p className="mt-4 text-lg leading-8 text-neutral-dark/80">
        We need someone to own the database layer of an open-source research
        tool for twelve weeks, with the possibility of renewal after the period.
      </p>
      <a
        href="#apply"
        className="mt-6 inline-flex rounded-md bg-secondary px-5 py-3 font-semibold text-white transition-colors hover:bg-secondary/90"
      >
        How to apply
      </a>
      <article className="prose prose-lg prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-primary prose-p:text-neutral-dark/80 prose-a:text-secondary prose-li:text-neutral-dark/80 mt-12 max-w-none">
        <h2>Who we are</h2>
        <p>
          Discourse Graphs is a philanthropically funded open-source project
          that helps research teams structure knowledge work, projects, and
          original research contributions. We do this by helping them represent
          their work as a structured graph (claims, evidence, requests) and move
          that structure between the tools they already use. We ship plugins for{" "}
          <strong>Roam Research</strong> and <strong>Obsidian</strong>, backed
          by a{" "}
          <a href="https://github.com/DiscourseGraphs/discourse-graph/tree/main/packages/database">
            shared Supabase database
          </a>
          , and we run live pilots with working scientific labs.
        </p>
        <p>
          We’re a distributed team of about eight, funded by the Chan Zuckerberg
          Initiative, The Navigation Fund, and the Astera Institute, with
          Homeworld Collective as our fiscal sponsor. The team includes a tech
          lead, UX designer, two front end engineers, two researcher/product
          owners, and a database architecture consultant. We are
          non-hierarchical and we work in the open.
        </p>
        <h2>The problem</h2>
        <p>
          Our database is the layer through which every platform talks to every
          other. Right now it has two gaps:
        </p>
        <ol>
          <li>
            <strong>It stores node titles, not node content.</strong> Which
            means agents and other clients can see that something exists but
            can’t read it.
          </li>
          <li>
            <strong>
              It can’t express a reference that crosses a graph boundary.
            </strong>{" "}
            Cross-graph citations and relation tracking are the next thing our
            users need, and the third-party system we’d planned to lean on has
            been discontinued.
          </li>
        </ol>
        <p>
          Closing the first gap, and laying the schema groundwork for the
          second, is what these twelve weeks are for.
        </p>
        <h2>What you’d work on</h2>
        <ul>
          <li>
            Finish the remaining milestones of a{" "}
            <strong>Roam ↔ Obsidian push/pull sync</strong>, including conflict
            handling on repeat sync and property alignment across two platforms
            with very different data models
          </li>
          <li>
            Extend the Supabase schema to store{" "}
            <strong>
              node templates, slot definitions, and full node content
            </strong>
            , and expose it through the API so agent tooling can read node
            bodies
          </li>
          <li>
            <strong>Import-time sanitization</strong>: page references and
            forward slashes in titles currently break sync in ways that are
            individually small and collectively corrosive
          </li>
          <li>
            Write a <strong>migration readiness assessment</strong> for Roam’s
            forthcoming data model: what it costs, what it implies for the UI,
            and when we should decide
          </li>
        </ul>
        <h2>
          What we’re <em>not</em> asking you to do
        </h2>
        <p>
          <strong>Out of scope:</strong> AT Protocol and federation work,
          cross-graph schema reconciliation design, distributed version control,
          and the Roam migration itself. These are real problems we care about.
          They are someone else’s ticket, or a later one.
        </p>
        <h2>What we’re looking for</h2>
        <h3>Required</h3>
        <ul>
          <li>
            Postgres as a primary skill: schema design, migrations, and the
            specific pain of keeping two clients in sync
          </li>
          <li>
            A track record of shipping a decision under unresolved ambiguity,
            and writing down what you didn’t choose
          </li>
          <li>
            Clear written communication, explaining tradeoffs and your
            rationale; owning human-readable communication with your colleagues
            in PRs and Linear tickets.
          </li>
          <li>
            Comfort bridging concrete and abstract working styles, making
            decisions that retain initial scope and solve problems in the face
            of potential scope expansion or disagreement
          </li>
        </ul>
        <h3>Helpful</h3>
        <ul>
          <li>
            Experience with Supabase specifically, or with
            sync/CRDT/offline-first systems
          </li>
          <li>
            Interest in federated protocols (AT Protocol, nanopublications,
            ActivityPub). This is not needed for this contract but is relevant
            to where we’re going.
          </li>
          <li>
            Any exposure to tools-for-thought, scientific infrastructure, or
            knowledge graphs
          </li>
          <li>
            Fluency with LLM-assisted development. We use it heavily. We also
            expect you to stand behind what lands in the repo.
          </li>
        </ul>
        <h2>How we work</h2>
        <p>
          Tickets in Linear and public pull requests. Each week also includes a
          1:1, developer meeting, and all-hands meeting. We build for the use
          case in front of us and leave room to rewrite. If a choice is cheap to
          reverse, make it and log the alternatives rather than convening about
          it. If it’s expensive to reverse, raise it with the tech lead.
        </p>
        <p>
          Your first week will focus on learning the tool from the user’s
          perspective before working with the data model. Over the next two to
          three weeks, you’ll get familiar with the codebase through adjacent
          tasks, giving you a strong foundation before working at that layer.
        </p>
        <h2>Logistics</h2>
        <ul>
          <li>
            <strong>Term:</strong> 12 weeks, fixed. We review fit and scope in
            week 6; extension is possible and would be agreed upon in writing.
          </li>
          <li>
            <strong>Rate:</strong> $8k/mo<strong>, approximately 20</strong>{" "}
            hours per week, invoiced semi-monthly through Homeworld Collective.
          </li>
          <li>
            <strong>Location:</strong> Fully remote. You’ll need a few hours of
            weekly overlap with US Pacific time.
          </li>
          <li>
            <strong>IP:</strong> Everything you write ships under Apache 2.0
            with your name in the commit history.
          </li>
        </ul>
        <h2 id="apply" className="scroll-mt-28">
          To apply
        </h2>
        <p>
          Email{" "}
          <a
            className="break-words"
            href="mailto:discoursegraphs@homeworld.bio"
          >
            discoursegraphs@homeworld.bio
          </a>{" "}
          with:
        </p>
        <ol>
          <li>
            A short note (1-2 paragraphs is plenty) about a schema or data-model
            decision you made, and what you’d do differently now
          </li>
          <li>Code we can read: a repo, a PR, anything public</li>
          <li>Your availability and rate</li>
        </ol>
        <p>
          We request applications by <strong>October 1,</strong> though
          applications can be rolling.
        </p>
        <p>
          First conversation is 30 minutes with Michael Gartner, our technical
          lead.
        </p>
      </article>
    </div>
  </main>
);

export default CareersPage;
