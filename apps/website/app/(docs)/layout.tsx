import { type Metadata } from "next";
import { Inter } from "next/font/google";
import clsx from "clsx";
import { customScrollbar } from "~/components/DocsLayout";
import { DESCRIPTION } from "~/data/constants";
import "~/globals.css";

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
  return (
    <div
      className={clsx(
        "flex min-h-screen w-full bg-white antialiased dark:bg-slate-900 [&::-webkit-scrollbar]:hidden",
        inter.variable,
        customScrollbar,
      )}
    >
      {children}
    </div>
  );
};

export default DocsLayout;
