import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import { getAllBlogs } from "~/(home)/blog/readBlogs";
import { Logo } from "~/components/Logo";
import { STATIC_NEWS_ITEMS } from "~/data/news";
import { PostHogProvider } from "../providers";
import { HomeNavigationMenu } from "./HomeNavigationMenu";
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
  // Matches the same condition Home() uses to render (or hide) the News
  // section itself, so the nav link never points at an empty section.
  const hasNews =
    STATIC_NEWS_ITEMS.length > 0 || (await getAllBlogs()).length > 0;
  const navigationItems = [
    { href: "/#about", label: "About" },
    { href: "/#resources", label: "Resources" },
    ...(hasNews ? [{ href: "/#news", label: "News" }] : []),
    { href: "/#talks", label: "Talks" },
    { href: "/#team", label: "Team" },
    { href: "/#supporters", label: "Supporters" },
    { href: "/docs", isDocumentNavigation: true, label: "Docs" },
    // Desktop shows Get started as a button and omits Contact; the mobile
    // menu keeps both because it has no separate buttons.
    { href: "/#plugins", isMobileOnly: true, label: "Get started" },
    { href: "/#contact", isMobileOnly: true, label: "Contact" },
  ];

  return (
    <PostHogProvider>
      <div
        className={`marketing-site flex min-h-screen flex-col bg-neutral-light text-neutral-dark antialiased [--header-height:4.5rem] [&:has([data-translucent-header])_header]:bg-white/80 [&:has([data-translucent-header])_header]:backdrop-blur-md ${inter.className}`}
      >
        <div className="border-b border-primary/20 bg-primary px-4 py-2 text-center">
          <Link
            href="/careers"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-neutral-dark transition-colors hover:text-neutral-dark/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-dark"
          >
            <span>We’re hiring a database engineer</span>
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
            >
              →
            </span>
          </Link>
        </div>
        <header className="sticky top-0 z-50 h-[var(--header-height)] border-b border-neutral-dark/10 bg-neutral-light/95 backdrop-blur">
          <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-4 min-[360px]:gap-4 min-[360px]:px-5 md:px-6">
            <div className="flex items-center justify-between gap-4 lg:flex-1">
              <Logo />
            </div>

            <HomeNavigationMenu items={navigationItems} />

            <div className="hidden items-center justify-end gap-3 lg:flex lg:flex-1">
              {/* Use hard navigation across the marketing/docs boundary because client-side transitions can leak docs CSS. */}
              <a
                href="/docs"
                className="inline-flex items-center justify-center rounded-md border border-neutral-dark/20 bg-transparent px-4 py-2 text-sm font-semibold text-neutral-dark transition-colors hover:bg-neutral-dark/5"
              >
                Open docs
              </a>
              <Link
                href="/#plugins"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 hover:text-white"
              >
                Get started
              </Link>
            </div>
          </div>
        </header>
        {children}
      </div>
    </PostHogProvider>
  );
};

export default HomeLayout;
