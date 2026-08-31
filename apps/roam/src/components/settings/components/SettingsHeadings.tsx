import React from "react";

/** Names a group of related setting rows within one tab. */
export const SettingsSectionHeading = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className="font-semibold text-neutral-dark">{children}</div>;

/** A heading whose rows are subordinate to it, such as an override pair. */
export const SettingsGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <div className="text-base font-semibold text-neutral-dark">{title}</div>
    <div className="flex flex-col gap-4 pl-4">{children}</div>
  </div>
);
