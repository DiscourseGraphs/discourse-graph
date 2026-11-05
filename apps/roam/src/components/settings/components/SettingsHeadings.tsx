import React from "react";

/** `bp3-heading` carries the themed text color; `border-0 border-solid` is
 *  required because Roam ships no Tailwind preflight to default border-style. */
const HEADING_CLASS =
  "bp3-heading mb-0 text-lg leading-tight pb-2 border-0 border-b-2 border-solid border-gray-300";

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
