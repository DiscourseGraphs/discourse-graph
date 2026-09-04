import React from "react";

/**
 * One heading style for every group of rows inside a tab, styled in
 * settingsStyles.css: the rows carry 14px semibold labels, so the heading has
 * to outrank them by size and by the weight of the rule under it, not by
 * indenting what sits beneath — indentation made whichever group used it look
 * like the odd one out.
 */
export const SettingsSectionHeading = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className="dg-settings-heading">{children}</div>;

/** A heading with the rows it names, for a pair or set that reads as one setting. */
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
