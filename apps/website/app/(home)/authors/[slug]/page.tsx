import type { Metadata } from "next";
import type { ReactElement } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  AUTHOR_PROFILES,
  getAuthorProfileBySlug,
  type AuthorWork,
} from "~/data/authorProfiles";

type AuthorPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const WorkList = ({ items }: { items: AuthorWork[] }): ReactElement => (
  <ul className="mt-5 divide-y divide-neutral-dark/10 border-y border-neutral-dark/10">
    {items.map((item) => (
      <li key={item.href} className="py-5">
        <Link
          href={item.href}
          className="group flex items-start justify-between gap-4"
        >
          <span>
            <span className="block font-semibold text-neutral-dark transition-colors group-hover:text-secondary">
              {item.title}
            </span>
            <span className="mt-1 block text-sm text-neutral-dark/60">
              {item.label}
            </span>
          </span>
          <ExternalLink
            className="mt-1 h-4 w-4 shrink-0 text-neutral-dark/45"
            aria-hidden="true"
          />
        </Link>
      </li>
    ))}
  </ul>
);

export const generateStaticParams = (): Array<{ slug: string }> =>
  AUTHOR_PROFILES.map(({ slug }) => ({ slug }));

export const generateMetadata = async ({
  params,
}: AuthorPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const profile = getAuthorProfileBySlug(slug);

  if (!profile) {
    return { title: "Author" };
  }

  return {
    title: `${profile.name} | Discourse Graphs`,
    description: profile.summary,
    alternates: {
      canonical: `/authors/${profile.slug}`,
    },
    openGraph: {
      title: `${profile.name} | Discourse Graphs`,
      description: profile.summary,
      type: "profile",
      images: [{ url: profile.image, alt: profile.name }],
      url: `/authors/${profile.slug}`,
    },
  };
};

const AuthorPage = async ({
  params,
}: AuthorPageProps): Promise<ReactElement> => {
  const { slug } = await params;
  const profile = getAuthorProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return (
    <main className="flex-1 px-5 py-12 sm:px-6 lg:py-20">
      <article className="mx-auto max-w-5xl">
        <Link
          href="/#team"
          className="inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors hover:text-secondary/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the team
        </Link>

        <header className="mt-8 grid gap-8 border-b border-neutral-dark/10 pb-10 sm:grid-cols-[10rem_1fr] sm:items-center">
          <div className="relative h-40 w-40 overflow-hidden rounded-full bg-white">
            <Image
              src={profile.image}
              alt={profile.name}
              fill
              priority
              sizes="160px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
              Author profile
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
              {profile.name}
            </h1>
            <p className="mt-4 text-lg leading-8 text-neutral-dark/75">
              {profile.summary}
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-primary">
                Affiliations
              </h2>
              <ul className="mt-4 space-y-3">
                {profile.affiliations.map((affiliation) => (
                  <li key={`${affiliation.name}-${affiliation.role}`}>
                    <Link
                      href={affiliation.href}
                      className="font-semibold text-neutral-dark transition-colors hover:text-secondary"
                    >
                      {affiliation.name}
                    </Link>
                    <p className="text-sm text-neutral-dark/60">
                      {affiliation.role}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {profile.externalProfiles.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-primary">Profiles</h2>
                <ul className="mt-4 space-y-3">
                  {profile.externalProfiles.map((externalProfile) => (
                    <li key={externalProfile.href}>
                      <Link
                        href={externalProfile.href}
                        className="inline-flex items-center gap-2 font-semibold text-secondary transition-colors hover:text-secondary/70"
                      >
                        {externalProfile.label}
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>

          <div className="space-y-10">
            <section>
              <h2 className="text-2xl font-semibold text-primary">
                Publications
              </h2>
              <WorkList items={profile.publications} />
            </section>
            <section>
              <h2 className="text-2xl font-semibold text-primary">Talks</h2>
              <WorkList items={profile.talks} />
            </section>
          </div>
        </div>
      </article>
    </main>
  );
};

export default AuthorPage;
