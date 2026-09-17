import React from "react";
import { Button } from "@blueprintjs/core";
import { buildBreadcrumbTrail } from "../utils/settingsNavigation";
import { useSettingsNav } from "./SettingsNavContext";

/** `ancestorLabels` are static crumbs above the tab itself: shown in the trail, not navigable. */
const SettingsPageHeader = ({
  ancestorLabels,
  rootLabel,
  resolveLabel,
}: {
  ancestorLabels: readonly string[];
  rootLabel: string;
  resolveLabel: (segment: string, segmentIndex: number) => string;
}): JSX.Element | null => {
  const { path, depth, pop, goToDepth } = useSettingsNav();
  if (depth === 0) return null;

  // depth > 0, so the trail always has a root crumb plus at least one segment.
  const trail = buildBreadcrumbTrail({ path, rootLabel, resolveLabel });
  const current = trail[trail.length - 1];
  const parent = trail[trail.length - 2];

  return (
    // Shrinkable by default: without flex-shrink-0 the header squashes into the scrolling body.
    <div className="mb-5 block flex-shrink-0">
      <div className="mb-1 flex items-center gap-2 text-2xl font-semibold leading-tight">
        <Button
          minimal
          small
          icon="chevron-left"
          title={`Back to ${parent.label}`}
          aria-label={`Back to ${parent.label}`}
          onClick={pop}
        />
        {current.label}
      </div>
      <div className="text-sm leading-snug text-gray-500">
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
                  className="cursor-pointer"
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
