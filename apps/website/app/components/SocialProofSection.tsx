import type { ReactElement } from "react";
import Image from "next/image";
import { SectionHeader } from "~/components/SectionHeader";

type Organization = {
  logo?: string;
  name: string;
};

const LOGO_DIR = "/organization-logos";

const ORGANIZATIONS: Organization[] = [
  {
    logo: "University_of_Washington_signature.svg",
    name: "University of Washington",
  },
  {
    logo: "University_of_Maryland_wordmark.svg",
    name: "University of Maryland",
  },
  {
    logo: "Johns_Hopkins_University_logo.svg",
    name: "Johns Hopkins University",
  },
  { logo: "Yale_University_logo.svg", name: "Yale University" },
  {
    logo: "Northwestern_University_official.svg",
    name: "Northwestern University",
  },
  { logo: "NYU_logo.svg", name: "NYU" },
  { logo: "WashU_official.svg", name: "Washington University in St. Louis" },
  { logo: "Syracuse_University_official.svg", name: "Syracuse University" },
  { logo: "McGill_University_logo.svg", name: "McGill University" },
  { logo: "University_of_Toronto_logo.svg", name: "University of Toronto" },
  { logo: "Queens_University_wordmark.svg", name: "Queen's University" },
  { logo: "Allen_Institute_logo.svg", name: "Allen Institute" },
  { logo: "Stowers_Institute_logo.svg", name: "Stowers Institute" },
  {
    logo: "UK_Dementia_Research_Institute_official.svg",
    name: "UK Dementia Research Institute",
  },
  {
    logo: "Quantum_Biology_Institute_official.svg",
    name: "Quantum Biology Institute",
  },
];

const OrganizationCard = ({ logo, name }: Organization): ReactElement => (
  <li className="flex h-24 w-56 shrink-0 items-center justify-center gap-3 rounded-lg border border-neutral-dark/10 bg-white px-6">
    {logo ? (
      <Image
        src={`${LOGO_DIR}/${logo}`}
        alt={name}
        width={160}
        height={48}
        className="h-12 w-auto max-w-[10rem] object-contain"
      />
    ) : null}
    {!logo && (
      <span className="text-center text-base font-semibold leading-tight text-primary">
        {name}
      </span>
    )}
  </li>
);

const OrganizationList = ({
  isHidden = false,
}: {
  isHidden?: boolean;
}): ReactElement => (
  <ul
    aria-hidden={isHidden || undefined}
    className={`flex shrink-0 items-center gap-4 pr-4 motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 ${isHidden ? "motion-reduce:hidden" : ""}`}
  >
    {ORGANIZATIONS.map((organization) => (
      <OrganizationCard key={organization.name} {...organization} />
    ))}
  </ul>
);

export const SocialProofSection = (): ReactElement => (
  <section className="overflow-hidden bg-white pt-16 lg:pt-24">
    <div className="mx-auto max-w-7xl px-5 sm:px-6">
      <SectionHeader
        eyebrow="Used by"
        isWide
        title="Pilot users at universities and research institutes"
        description="Researchers across North America and the UK are using discourse graphs in their work."
      />
    </div>
    <div className="mx-auto mt-10 max-w-7xl px-5 sm:px-6">
      <div className="group flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:[mask-image:none]">
        <div className="animate-marquee flex w-max group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none">
          <OrganizationList />
          <OrganizationList isHidden />
        </div>
      </div>
    </div>
  </section>
);
