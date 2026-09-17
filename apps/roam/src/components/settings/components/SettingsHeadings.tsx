import React from "react";

/** `border-0 border-solid` is required: Roam ships no Tailwind preflight, so a
 *  bare `border-b-2` has no border-style and paints nothing. */
const HEADING_CLASS =
  "text-lg font-semibold leading-tight pb-2 border-0 border-b-2 border-solid dg-settings-heading";

export const SettingsSectionHeading = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement => <div className={HEADING_CLASS}>{children}</div>;

export const SettingsGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <div className="flex flex-col gap-1">
    <div className={HEADING_CLASS}>{title}</div>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
);
