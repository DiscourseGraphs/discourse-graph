import type { Metadata } from "next";
import "~/globals.css";
import { PostHogProvider } from "../providers";
import Link from "next/link";
import { Inter } from "next/font/google";
import { getAllBlogs } from "~/(home)/blog/readBlogs";
import { Logo } from "~/components/Logo";

export const metadata: Metadata = {
  title: "Discourse Graphs | A Tool for Collaborative Knowledge Synthesis",
  description:
    "Discourse Graphs are a tool and ecosystem for collaborative knowledge synthesis, enabling researchers to map ideas and arguments in a modular, composable graph format.",
  openGraph: {
    title: "Discourse Graphs",
    description: "A tool and ecosystem for collaborative knowledge synthesis",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Discourse Graphs",
    description: "A tool and ecosystem for collaborative knowledge synthesis",
  },
};

const inter = Inter({ subsets: ["latin"] });

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  const hasUpdates = !!(await getAllBlogs()).length;
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <PostHogProvider>
          <div
            className={`flex min-h-screen flex-col bg-neutral-light ${inter.className}`}
          >
            {/* Job Openings Banner */}
            <div className="border-b border-primary/20 bg-gradient-to-r from-primary via-primary/90 to-primary px-4 py-3 text-center shadow-sm">
              <Link
                href="https://docs.google.com/document/d/1UKwmUoAvgdLXFPj8bfsbMWUFbK8h6I8JgDv8lqHfJ_M/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-neutral-dark transition-colors hover:text-neutral-dark/80 focus:outline-none focus:ring-2 focus:ring-neutral-dark focus:ring-offset-2 focus:ring-offset-primary"
              >
                <span className="animate-pulse" aria-hidden="true">
                  🚀
                </span>
                <span>
                  We&apos;re hiring a Product Adoption Facilitator / Cybrarian!
                </span>
                <span
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  →
                </span>
              </Link>
            </div>

            <header className="flex flex-col items-center justify-between space-y-4 px-6 py-4 md:flex-row md:space-y-0">
              <Logo />
              <nav className="w-full md:w-auto">
                <ul className="flex flex-wrap justify-center space-x-4 md:flex-nowrap md:space-x-8">
                  {[
                    "About",
                    "Resources",
                    "Events",
                    hasUpdates && "Updates",
                    "Talks",
                    "Team",
                    "Supporters",
                    "Contact",
                  ]
                    .filter((item): item is string => Boolean(item))
                    .map((item) => (
                      <li key={item}>
                        <Link
                          href={`/#${item.toLowerCase()}`} // Ensures absolute path with root `/`
                          className="text-neutral-dark hover:text-neutral-dark/60"
                        >
                          {item}
                        </Link>
                      </li>
                    ))}
                </ul>
              </nav>
            </header>
            {children}
          </div>
        </PostHogProvider>
      </body>
    </html>
  );
};

export default RootLayout;
