import type { ReactElement } from "react";

type SectionHeaderProps = {
  description?: string;
  eyebrow?: string;
  isWide?: boolean;
  title: string;
};

export const SectionHeader = ({
  description,
  eyebrow,
  isWide = false,
  title,
}: SectionHeaderProps): ReactElement => (
  <div className={isWide ? "max-w-none md:flex-1" : "max-w-3xl"}>
    {eyebrow && (
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
        {eyebrow}
      </p>
    )}
    <h2 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
      {title}
    </h2>
    {description && (
      <p className="mt-4 text-lg leading-8 text-neutral-dark/75">
        {description}
      </p>
    )}
  </div>
);
