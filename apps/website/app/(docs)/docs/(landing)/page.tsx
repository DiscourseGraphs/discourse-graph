import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { PlatformBadge } from "~/components/PlatformBadge";
import { Logo } from "~/components/Logo";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Choose the Discourse Graphs documentation for Roam Research or Obsidian.",
};

const DOCS_DESTINATIONS = [
  {
    description:
      "Installation, graph building, querying, and advanced workflows for the Roam Research plugin.",
    href: "/docs/roam",
    platform: "roam",
    title: "Roam docs",
  },
  {
    description:
      "Setup, node and relation authoring, sync, and workspace configuration for the Obsidian plugin.",
    href: "/docs/obsidian",
    platform: "obsidian",
    title: "Obsidian docs",
  },
] as const;

const DocsLandingPage = (): React.ReactElement => {
  return (
    <div className="marketing-site font-[family:var(--font-inter)] min-h-screen bg-neutral-light text-neutral-dark">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Logo />
          {/* Use hard navigations across the marketing/docs boundary because Next client transitions can leave the wrong route CSS active. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="text-sm font-medium text-neutral-dark/70 hover:text-neutral-dark"
          >
            Back to site
          </a>
        </div>
      </header>

      <main className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <section className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
              Documentation
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
              Choose your docs
            </h1>
            <p className="mt-6 text-lg leading-8 text-neutral-dark/80">
              Discourse Graphs has separate documentation for each client. Pick
              the one you are using to get the right setup instructions,
              workflows, and reference pages.
            </p>
          </section>

          <section className="mt-12 grid gap-6 md:grid-cols-2">
            {DOCS_DESTINATIONS.map(({ description, href, platform, title }) => (
              // Use a document navigation here so Nextra and marketing CSS do not coexist during client-side route transitions.
              /* eslint-disable-next-line @next/next/no-html-link-for-pages */
              <a key={href} href={href} className="group block h-full">
                <Card className="h-full rounded-2xl border border-black/5 bg-white shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-8 p-8">
                    <div className="flex items-start justify-between gap-4">
                      <PlatformBadge platform={platform} />
                      <ArrowRight className="h-5 w-5 shrink-0 text-neutral-dark/40 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-secondary" />
                    </div>

                    <div className="space-y-4">
                      <h2 className="text-2xl font-semibold tracking-tight text-primary">
                        {title}
                      </h2>
                      <p className="text-base leading-7 text-neutral-dark/75">
                        {description}
                      </p>
                    </div>

                    <p className="mt-auto text-sm font-semibold text-secondary">
                      Open documentation
                    </p>
                  </CardContent>
                </Card>
              </a>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
};

export default DocsLandingPage;
