import type { Metadata } from "next";
import { Prose } from "~/components/Prose";

export const metadata: Metadata = {
  title: "Product Adoption Facilitator / Cybrarian",
  description:
    "Part-time role helping research groups adopt Discourse Graphs and build a community of users.",
};

const CybrarianPage = () => {
  return (
    <div className="py-16">
      <Prose className="mx-auto !max-w-3xl px-4">
        {/* Hero section */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Product Adoption Facilitator / Cybrarian
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Help transform scientific research through Discourse Graphs
          </p>
        </div>

        {/* Quick highlights */}
        <div className="mb-12 rounded-lg bg-slate-50 p-6 dark:bg-slate-800/50">
          <h3 className="mb-3 mt-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Position Highlights
          </h3>
          <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
            <div>• Part-time remote (10-25 hours/week)</div>
            <div>• $2000-4000/mo depending on commitment</div>
            <div>• 6-18 month contractor role</div>
            <div>• Flexible availability across time zones</div>
          </div>
        </div>

        <h2>About the Project</h2>
        <p>
          We&apos;re transforming how scientific research is communicated and
          coordinated through{" "}
          <a
            href="https://discoursegraphs.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Discourse Graphs
          </a>{" "}
          - a revolutionary approach that restructures research into
          interconnected, reusable knowledge components. Our team has developed
          plugins in popular knowledge and notetaking software that have already{" "}
          <a
            href="https://arxiv.org/html/2407.20666v2"
            target="_blank"
            rel="noopener noreferrer"
          >
            transformed
          </a>{" "}
          our labs into self-organizing research collectives, improving
          researcher agency, coordination, and satisfaction.
        </p>
        <p>
          With funding from The Chan Zuckerberg Initiative and The Navigation
          Fund, we&apos;re now introducing this structured approach to research
          labs worldwide. Our goal: reduce onboarding time from 3 weeks to 3
          days and build a thriving community of researchers using discourse
          graphs for modular, collaborative science.
        </p>

        <h2>The Role</h2>
        <p>
          We&apos;re seeking a{" "}
          <a
            href="https://robhaisfield.com/notes/roam-cybrarian/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cybrarian
          </a>
          /Research adoption facilitator to be the bridge between our
          development team and research users. You&apos;ll help scientists adopt
          Discourse Graphs, modify and introduce existing templates, document
          best practices, and cultivate a supportive user community. This is a
          part-time remote position (10-25 hours/week) for someone passionate
          about improving research workflows and knowledge sharing.
        </p>

        <h2>About us</h2>
        <p>
          We are a 7-person team (4 software engineers, 1 UX researcher, and 2
          principal investigators in{" "}
          <a
            href="https://joelchan.me/"
            target="_blank"
            rel="noopener noreferrer"
          >
            human-computer interaction
          </a>{" "}
          and{" "}
          <a
            href="https://sites.uw.edu/matsulab/team/"
            target="_blank"
            rel="noopener noreferrer"
          >
            cell biology
          </a>
          ) fiscally sponsored by the nonprofit{" "}
          <a
            href="https://www.homeworld.bio/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Homeworld Collective
          </a>
          . We are running a two-year{" "}
          <a
            href="https://commons.datacite.org/doi.org/10.71707/cx83-dh41"
            target="_blank"
            rel="noopener noreferrer"
          >
            pilot
          </a>{" "}
          to introduce discourse graph tooling to research labs across the
          world. Our open-source{" "}
          <a
            href="https://github.com/DiscourseGraphs/discourse-graph"
            target="_blank"
            rel="noopener noreferrer"
          >
            plugins
          </a>{" "}
          live in the graph-based notetaking apps Roam Research and Obsidian,
          will be extended to Notion, and will allow researchers to share and
          cite individual research results and hypotheses. Our plugins have been
          transformative for our labs, but a substantial learning curve remains
          for new users. This role will help to lower the barrier to entry for
          new and existing users, particularly research labs.
        </p>

        <h2>Key Responsibilities</h2>
        <ul>
          <li>
            <strong>User Success</strong>
            <ul>
              <li>Onboard new research groups to discourse graph tools</li>
              <li>
                Schedule and lead follow-up meetings to ensure adoption success
              </li>
              <li>
                Identify user pain points and communicate them to our UX team
              </li>
              <li>
                Apply users&apos; existing scientific content to discourse graph
                templates
              </li>
            </ul>
          </li>
          <li>
            <strong>Technical Support</strong>
            <ul>
              <li>Help users navigate Roam Research and other platforms</li>
              <li>Clone and update user graphs with new functionalities</li>
              <li>Troubleshoot basic technical issues or escalate as needed</li>
              <li>
                Work with project and knowledge management tools (Linear, Roam
                Research)
              </li>
            </ul>
          </li>
          <li>
            <strong>Documentation &amp; Resources</strong>
            <ul>
              <li>Create and update user-facing tutorials and guides</li>
              <li>Document best practices from successful implementations</li>
              <li>
                Develop and modify templates in discourse graph plugins for
                different research needs
              </li>
              <li>
                Maintain a knowledge base of common solutions and workflows
              </li>
            </ul>
          </li>
          <li>
            <strong>Community Building</strong>
            <ul>
              <li>Foster knowledge sharing between research groups</li>
              <li>Connect users facing similar challenges</li>
              <li>Share success stories and innovative use cases</li>
              <li>Act as liaison between users and development team</li>
            </ul>
          </li>
        </ul>

        <h2>Core Requirements</h2>
        <ul>
          <li>
            <strong>Strong communication skills</strong> - explain complex
            concepts simply and listen actively
          </li>
          <li>
            <strong>Self-directed project management</strong> - juggle multiple
            user groups proactively
          </li>
          <li>
            <strong>Technical curiosity</strong> - willingness to learn new
            tools (no prior expertise required)
          </li>
          <li>
            <strong>User-centered mindset</strong> - genuine interest in helping
            users with new technologies
          </li>
          <li>
            <strong>Early-stage technology comfort</strong> - able to learn
            evolving software with documentation
          </li>
          <li>
            <strong>Meeting facilitation</strong> - comfortable scheduling and
            leading check-ins
          </li>
          <li>
            <strong>Flexible availability</strong> - accommodate meetings across
            time zones - most users are in US time zones
          </li>
        </ul>

        <h2>Nice to Have</h2>
        <ul>
          <li>
            <strong>Technical</strong>: Knowledge of knowledge management and
            notetaking tools (Roam Research, Notion, Obsidian); comfort
            learning/editing pseudocode eg in{" "}
            <a
              href="https://github.com/RoamJS/smartblocks/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Roam Smartblocks
            </a>
            )
          </li>
          <li>
            <strong>Domain</strong>: Familiarity or experience in original
            research (eg scientific research), scientific workflows, open
            science principles
          </li>
          <li>
            <strong>Professional</strong>: Experience in any of: product
            support, customer success, UX research, solutions architect,
            technical documentation, scientific research, teaching/training
          </li>
        </ul>

        <h2>Pay</h2>
        <p>
          This is a 6-18 month contractor role paid in installments of
          $2000-4000/mo, depending on time commitment and experience.
        </p>

        <h2>Who Should Apply</h2>
        <p>
          <strong>What matters most:</strong> Your ability to understand user
          needs, adopt and adapt transformative knowledge management tools, and
          an enthusiasm for improving research collaboration. We will
          incorporate your prior experience into the position and redefine it
          accordingly.
        </p>

        <h2>To Apply</h2>
        <p>
          Please send a short pre-application by filling out the following form.
          You&apos;ll describe your interest, relevant experience, and
          availability. Preference will be given for pre-applications submitted
          before <strong>August 20.</strong>
        </p>

        {/* CTA Button */}
        <div className="my-8 text-center">
          <a
            href="https://forms.fillout.com/t/2DmzUKaY8Sus"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-orange-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-orange-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
          >
            Apply Now
            <svg
              className="ml-2 h-5 w-5"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>

        <div className="mt-8 rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
          <p className="text-center text-blue-900 dark:text-blue-100">
            <em>
              This position offers the unique opportunity to shape the future of
              scientific communication while working with cutting-edge research
              teams worldwide.
            </em>
          </p>
        </div>
      </Prose>
    </div>
  );
};

export default CybrarianPage;
