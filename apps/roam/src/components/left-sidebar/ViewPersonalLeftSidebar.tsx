import { getPersonalSetting } from "~/components/settings/block-prop/utils/accessors";
import { PersonalSettingsSchema } from "~/components/settings/block-prop/utils/zodSchema";
import { CollapsiblePanel } from "~/components/settings/block-prop/components/CollapsiblePanel";
import { getPersonalSettingsKey } from "~/components/settings/block-prop/utils/init";
import React from "react";
import { SectionChildren } from "./utils";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { extractRef } from "roamjs-components/util";

export const ViewPersonalLeftSidebar = () => {
  const rawSettings = getPersonalSetting(["Left Sidebar"]);
  const settings = PersonalSettingsSchema.shape["Left Sidebar"].parse(
    rawSettings || {},
  );

  const sectionEntries = Object.entries(settings);

  if (!sectionEntries.length) return null;

  const personalSettingsKey = getPersonalSettingsKey();

  return (
    <div className="personal-left-sidebar-sections">
      {sectionEntries.map(([sectionName, sectionData]) => {
        const children = sectionData.Children || [];

        if (!children.length) return null;

        const ref = extractRef(sectionName);
        const blockText = getTextByBlockUid(ref);
        const displayName = (blockText || sectionName).toUpperCase();
        const folded = sectionData.Settings.Folded;
        const truncateAt = sectionData.Settings["Truncate-result?"];

        const childrenNodes = children.map((child) => ({
          uid: child.Page,
          text: child.Page,
          alias: child.Alias ? { value: child.Alias } : undefined,
        }));

        const header = (
          <span className="flex items-center font-semibold">{displayName}</span>
        );

        return (
          <div key={sectionName} className="personal-left-sidebar-section">
            <CollapsiblePanel
              variant="sidebar"
              header={header}
              settingKey={[
                personalSettingsKey,
                "Left Sidebar",
                sectionName,
                "Settings",
                "Folded",
              ]}
              defaultOpen={!folded}
              className="!hover:bg-transparent !border-none !bg-transparent !p-0"
            >
              <SectionChildren
                childrenNodes={childrenNodes}
                truncateAt={truncateAt}
              />
            </CollapsiblePanel>
          </div>
        );
      })}
    </div>
  );
};
