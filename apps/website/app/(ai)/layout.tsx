import type { Metadata } from "next";
import "~/globals.css";
import "@repo/ui/globals.css";
import Image from "next/image";
import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";

export const metadata: Metadata = {
  title: "AI Extract | Discourse Graphs",
  description:
    "Extract structured discourse graph nodes from academic papers using AI.",
};

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

type AILayoutProps = {
  children: React.ReactNode;
};

const AILayout = ({ children }: AILayoutProps) => {
  return (
    <html lang="en">
      <body className={`${jakarta.className} antialiased`}>
        <div className="flex h-screen min-h-screen flex-col bg-[#eef2f7]">
          <header className="shrink-0 border-b border-slate-200/90 bg-white px-4 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="flex w-full items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2.5 no-underline">
                <Image
                  src="/logo-screenshot-48.png"
                  alt="Discourse Graphs Logo"
                  width={26}
                  height={26}
                />
                <span className="text-[16px] font-semibold tracking-[-0.015em] text-slate-900">
                  Discourse Graphs
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                  AI Extract
                </span>
              </Link>

              <Link
                href="/"
                className="rounded-full border border-transparent px-3 py-1.5 text-[14px] font-medium text-slate-500 no-underline transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-700"
              >
                Back to site
              </Link>
            </div>
          </header>

          <main className="flex min-h-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
};

export default AILayout;
