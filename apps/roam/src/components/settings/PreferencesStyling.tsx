import React from "react";
import { addStyle } from "roamjs-components/dom";
import {
  showDiscourseFloatingMenu,
  hideDiscourseFloatingMenu,
} from "~/components/DiscourseFloatingMenu";
import { STREAMLINE_STYLING_KEY } from "~/data/userSettings";
import { setSetting } from "~/utils/extensionSettings";
import streamlineStyling from "~/styles/streamlineStyling";
import { PersonalFlagPanel } from "./components/BlockPropSettingPanels";
import { PERSONAL_KEYS } from "./utils/settingKeys";
import { type SettingsSnapshot } from "./utils/accessors";

const PreferencesStyling = ({
  personalSettings,
}: {
  personalSettings: SettingsSnapshot["personalSettings"];
}) => (
  <div className="flex flex-col gap-4 p-1">
    <PersonalFlagPanel
      title="Streamline styling"
      description="Apply streamlined styling to your personal graph for a cleaner appearance."
      settingKeys={[PERSONAL_KEYS.streamlineStyling]}
      initialValue={personalSettings[PERSONAL_KEYS.streamlineStyling]}
      onChange={(checked) => {
        void setSetting(STREAMLINE_STYLING_KEY, checked);
        const existingStyleElement =
          document.getElementById("streamline-styling");

        if (checked && !existingStyleElement) {
          const styleElement = addStyle(streamlineStyling);
          styleElement.id = "streamline-styling";
        } else if (!checked && existingStyleElement) {
          existingStyleElement.remove();
        }
      }}
    />
    <PersonalFlagPanel
      title="Hide feedback button"
      description="Hide the 'Send feedback' button at the bottom right of the screen."
      settingKeys={[PERSONAL_KEYS.hideFeedbackButton]}
      initialValue={personalSettings[PERSONAL_KEYS.hideFeedbackButton]}
      onChange={(checked) => {
        void setSetting("hide-feedback-button", checked);
        if (checked) {
          hideDiscourseFloatingMenu();
        } else {
          showDiscourseFloatingMenu();
        }
      }}
    />
  </div>
);

export default PreferencesStyling;
