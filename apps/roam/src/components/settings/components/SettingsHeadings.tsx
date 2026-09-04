import React from "react";

/**
 * One heading style for every group of rows inside a tab. The rows themselves
 * carry a semibold label, so the heading is set apart by case and size rather
 * than by indenting what sits under it — indentation made whichever group used
 * it look like the odd one out.
 */
const HEADING_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-neutral-dark";

/** Names a group of related setting rows within one tab. */
export const SettingsSectionHeading = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className={HEADING_CLASS}>{children}</div>;

/** A heading with the rows it names, for a pair or set that reads as one setting. */
export const SettingsGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2">
    <div className={HEADING_CLASS}>{title}</div>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
);
