import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { getAuthorProfileByName } from "~/data/authorProfiles";

const AUTHOR_NAME_PATTERN = /(Matthew Akamatsu|Matt Akamatsu|Joel Chan)/gu;

type AuthorLinkProps = {
  authorName: string;
  className?: string;
};

export const AuthorLink = ({
  authorName,
  className,
}: AuthorLinkProps): ReactElement => {
  const profile = getAuthorProfileByName(authorName);

  if (!profile) {
    return <span className={className}>{authorName}</span>;
  }

  return (
    <Link href={`/authors/${profile.slug}`} className={className}>
      {authorName}
    </Link>
  );
};

export const LinkedAuthorText = ({ text }: { text: string }): ReactNode[] =>
  text.split(AUTHOR_NAME_PATTERN).map((segment, index) => {
    const profile = getAuthorProfileByName(segment);

    if (!profile) {
      return segment;
    }

    return (
      <AuthorLink
        key={`${profile.slug}-${index}`}
        authorName={segment}
        className="decoration-current/35 underline underline-offset-4 transition-colors hover:text-primary"
      />
    );
  });
