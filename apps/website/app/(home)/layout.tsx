import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import { getAllBlogs } from "~/(home)/blog/readBlogs";
import { Logo } from "~/components/Logo";
import { PostHogProvider } from "../providers";
import "~/globals.css";

export const metadata: Metadata = {
  title: "Discourse Graphs | A Tool for Collaborative Knowledge Synthesis",
  description:
    "Discourse Graphs are a tool and ecosystem for collaborative knowledge synthesis, enabling researchers to map ideas and arguments in a modular, composable graph format.",
  openGraph: {
    title: "Discourse Graphs",
    description: "A tool and ecosystem for collaborative knowledge synthesis",
    type: "website",
    images: [
      {
        url: "/MATSU_lab_journal_club_graph_view.png",
        width: 1200,
        height: 630,
        alt: "Discourse Graphs collaboration map preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discourse Graphs",
    description: "A tool and ecosystem for collaborative knowledge synthesis",
    images: ["/MATSU_lab_journal_club_graph_view.png"],
  },
};

const inter = Inter({ subsets: ["latin"] });

const HomeLayout = async ({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> => {
  const hasUpdates = !!(await getAllBlogs()).length;
  const navigationItems = [
    { href: "/#about", label: "About" },
    { href: "/#plugins", label: "Plugins" },
    { href: "/#resources", label: "Resources" },
    { href: "/#events", label: "Events" },
    ...(hasUpdates ? [{ href: "/#updates", label: "Updates" }] : []),
    { href: "/#talks", label: "Talks" },
    { href: "/#team", label: "Team" },
  ];

  return (
    <PostHogProvider>
      <div
        className={`marketing-site flex min-h-screen flex-col bg-neutral-light text-neutral-dark antialiased ${inter.className}`}
      >
        <header className="sticky top-0 z-50 border-b border-neutral-dark/10 bg-neutral-light/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex items-center justify-between gap-4">
              <Logo />
              {/* Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/docs"
                className="rounded-md border border-neutral-dark/15 px-3 py-2 text-sm font-semibold text-neutral-dark transition-colors hover:border-secondary hover:text-secondary md:hidden"
              >
                Docs
              </a>
            </div>

            <nav aria-label="Primary navigation" className="md:flex md:flex-1">
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-neutral-dark/75 md:justify-end md:gap-x-5">
                {navigationItems.map((item) => (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      className="transition-colors hover:text-neutral-dark"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li className="hidden shrink-0 md:block">
                  {/* Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS. */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  <a
                    href="/docs"
                    className="transition-colors hover:text-neutral-dark"
                  >
                    Docs
                  </a>
                </li>
                <li className="shrink-0">
                  <Link
                    href="/#contact"
                    className="transition-colors hover:text-neutral-dark"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="hidden md:block">
              {/* Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/docs"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 hover:text-white"
              >
                Open docs
              </a>
            </div>
          </div>
        </header>
        {children}
      </div>
    </PostHogProvider>
  );
};

export default HomeLayout;
