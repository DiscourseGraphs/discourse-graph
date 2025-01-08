import type { Metadata } from "next";
import "~/globals.css";
import { PostHogProvider } from "../providers";
import Link from "next/link";
import Image from "next/image";
import { Inter } from "next/font/google";
import { getAllBlogs } from "~/(home)/blog/readBlogs";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasUpdates = !!(await getAllBlogs()).length;
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <PostHogProvider>
          <div
            className={`flex min-h-screen flex-col bg-neutral-light ${inter.className}`}
          >
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
                    hasUpdates && "Updates",
                    "Talks",
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
}
