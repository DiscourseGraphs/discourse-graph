import { type Metadata } from "next";
import { Inter } from "next/font/google";
import clsx from "clsx";
import { customScrollbar } from "~/components/Layout";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={clsx("h-full antialiased", inter.variable, customScrollbar)}
      suppressHydrationWarning
    >
      <body className="flex min-h-full bg-white dark:bg-slate-900 [&::-webkit-scrollbar]:hidden">
        <div className="w-full pt-[64px]">{children}</div>
      </body>
    </html>
  );
}
