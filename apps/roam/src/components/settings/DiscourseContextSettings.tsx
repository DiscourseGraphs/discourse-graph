import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import posthog from "posthog-js";
import {
  getOverlayHandler,
  onPageRefObserverChange,
} from "~/utils/pageRefObserverHandlers";
import { setSetting } from "~/utils/extensionSettings";
import { PersonalFlagPanel } from "./components/BlockPropSettingPanels";
import { PERSONAL_KEYS } from "./utils/settingKeys";
import { type SettingsSnapshot } from "./utils/accessors";
import { ROAM_DOCS, withDocsLink } from "./utils/docs";

const DiscourseContextSettings = ({
  onloadArgs,
  personalSettings,
}: {
  onloadArgs: OnloadArgs;
  personalSettings: SettingsSnapshot["personalSettings"];
}) => {
  const overlayHandler = getOverlayHandler(onloadArgs);
  return (
    <div className="flex flex-col gap-4 p-1">
      <PersonalFlagPanel
        title="Overlay"
        description={withDocsLink(
          "Whether or not to overlay discourse context information over discourse node references.",
          ROAM_DOCS.discourseContextOverlay,
        )}
        settingKeys={[PERSONAL_KEYS.discourseContextOverlay]}
        initialValue={personalSettings[PERSONAL_KEYS.discourseContextOverlay]}
        onChange={(checked) => {
          void setSetting("discourse-context-overlay", checked);
          onPageRefObserverChange(overlayHandler)(checked);
          posthog.capture("Personal Settings: Overlay Toggled", {
            enabled: checked,
          });
        }}
      />
    </div>
  );
};

export default DiscourseContextSettings;
