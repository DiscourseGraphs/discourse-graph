import type { Metadata, ResolvingMetadata } from "next";
import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const title = "Careers | Discourse Graphs";
const description = "We don’t have any open positions right now.";

export const generateMetadata = async (
  _props: unknown,
  parent?: ResolvingMetadata,
): Promise<Metadata> => {
  // Nextra's page map calls this without Next.js's parent metadata argument.
  const inherited = await parent;
  return {
    title,
    description,
    openGraph: { ...inherited?.openGraph, title, description },
    twitter: { ...inherited?.twitter, title, description },
  };
};

const CareersPage = (): ReactElement => (
  <main className="flex-1 px-5 py-16 sm:px-6 lg:py-24">
    <div className="mx-auto max-w-3xl">
      <Link
        href="/#team"
        className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-secondary/70"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Meet the team
      </Link>
      <h1 className="mt-8 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
        Careers
      </h1>
      <p className="mt-4 text-lg leading-8 text-neutral-dark/80">
        {description}
      </p>
    </div>
  </main>
);

export default CareersPage;
