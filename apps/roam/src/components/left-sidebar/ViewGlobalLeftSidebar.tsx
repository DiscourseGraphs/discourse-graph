import { getGlobalSetting } from "~/components/settings/block-prop/utils/accessors";
import { GlobalSettingsSchema } from "~/components/settings/block-prop/utils/zodSchema";
import { CollapsiblePanel } from "~/components/settings/block-prop/components/CollapsiblePanel";
import React from "react";
import { SectionChildren } from "./utils";

export const ViewGlobalLeftSidebar = () => {
  const settings = GlobalSettingsSchema.shape["Left Sidebar"].parse(
    getGlobalSetting(["Left Sidebar"]) || {},
  );

  const children = settings.Children || [];
  const folded = settings.Settings.Folded;
  const collapsable = settings.Settings.Collapsable;

  if (!children.length) return null;

  const childrenNodes = children.map((uid) => ({
    uid,
    text: uid,
  }));

  const header = (
    <span className="flex items-center font-semibold">GLOBAL</span>
  );

  if (collapsable) {
    return (
      <div className="global-left-sidebar-section">
        <CollapsiblePanel
          variant="sidebar"
          header={header}
          settingKey={["Left Sidebar", "Settings", "Folded"]}
          defaultOpen={!folded}
          className="!hover:bg-transparent !border-none !bg-transparent !p-0"
        >
          <SectionChildren childrenNodes={childrenNodes} />
        </CollapsiblePanel>
      </div>
    );
  }

  return (
    <div className="global-left-sidebar-section">
      <div className="sidebar-title-button flex w-full items-center border-none bg-transparent py-1 pl-6 pr-2.5 font-semibold outline-none">
        <span>GLOBAL</span>
      </div>
      <SectionChildren childrenNodes={childrenNodes} />
    </div>
  );
};
