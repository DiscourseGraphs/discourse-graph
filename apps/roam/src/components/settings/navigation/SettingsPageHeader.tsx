import React from "react";
import { Button } from "@blueprintjs/core";
import { buildBreadcrumbTrail } from "../utils/settingsNavigation";
import { useSettingsNav } from "./SettingsNavContext";

/** `ancestorLabels` are static crumbs above the tab itself: shown in the trail, not navigable. */
const SettingsPageHeader = ({
  ancestorLabels,
  rootLabel,
  resolveLabel,
  dotColor,
}: {
  ancestorLabels: readonly string[];
  rootLabel: string;
  resolveLabel: (segment: string, segmentIndex: number) => string;
  dotColor?: string;
}): JSX.Element | null => {
  const { path, depth, pop, goToDepth } = useSettingsNav();
  if (depth === 0) return null;

  // depth > 0, so the trail always has a root crumb plus at least one segment.
  const trail = buildBreadcrumbTrail({ path, rootLabel, resolveLabel });
  const current = trail[trail.length - 1];
  const parent = trail[trail.length - 2];

  return (
    <div className="dg-settings-page-header">
      <div className="dg-settings-page-header__back">
        <Button
          minimal
          small
          icon="chevron-left"
          text={parent.label}
          onClick={pop}
        />
      </div>
      <div className="dg-settings-page-header__title">
        <span
          className="dg-settings-page-header__dot"
          style={dotColor ? { backgroundColor: dotColor } : undefined}
        />
        {current.label}
      </div>
      <div className="dg-settings-page-header__trail">
        {ancestorLabels.map((label) => (
          <span key={label}>{`${label} › `}</span>
        ))}
        {trail.map((crumb) => (
          <span key={crumb.depth}>
            {crumb.isCurrent ? (
              crumb.label
            ) : (
              <>
                <a
                  className="dg-settings-page-header__crumb"
                  onClick={() => goToDepth(crumb.depth)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      goToDepth(crumb.depth);
                  }}
                >
                  {crumb.label}
                </a>
                {" › "}
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default SettingsPageHeader;
