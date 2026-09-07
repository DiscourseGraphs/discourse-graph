import React from "react";

/** Styled in settingsStyles.css: outranks the rows by size and rule, never by indenting them. */
export const SettingsSectionHeading = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className="dg-settings-heading">{children}</div>;

export const SettingsGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="dg-settings-group">
    <div className="dg-settings-heading">{title}</div>
    <div className="dg-settings-group__rows flex flex-col gap-4">
      {children}
    </div>
  </div>
);
