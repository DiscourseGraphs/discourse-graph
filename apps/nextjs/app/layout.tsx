import type { Metadata } from "next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
