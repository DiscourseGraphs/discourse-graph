import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { DESCRIPTION } from "~/data/constants";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    template: "%s - Docs",
    default: "Discourse Graphs - Documentation",
  },
  description: DESCRIPTION,
};

const DocsLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className={`${inter.variable} antialiased`}>{children}</div>;
};

export default DocsLayout;
