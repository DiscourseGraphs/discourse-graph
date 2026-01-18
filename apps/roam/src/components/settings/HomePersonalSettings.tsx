import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { addStyle } from "roamjs-components/dom";
import { NodeMenuTriggerComponent } from "~/components/DiscourseNodeMenu";
import {
  getOverlayHandler,
  getSuggestiveOverlayHandler,
  onPageRefObserverChange,
  previewPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import {
  showDiscourseFloatingMenu,
  hideDiscourseFloatingMenu,
} from "~/components/DiscourseFloatingMenu";
import { NodeSearchMenuTriggerSetting } from "../DiscourseNodeSearchMenu";
import { DISCOURSE_TOOL_SHORTCUT_KEY } from "~/data/userSettings";
import { enablePostHog, disablePostHog } from "~/utils/posthog";
import KeyboardShortcutInput from "./KeyboardShortcutInput";
import streamlineStyling from "~/styles/streamlineStyling";
import { useFeatureFlag } from "./utils/hooks";
import { PersonalFlagPanel } from "./components/BlockPropSettingPanels";

const HomePersonalSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const overlayHandler = getOverlayHandler(onloadArgs);
  const suggestiveModeEnabled = useFeatureFlag("Suggestive Mode Enabled");

  return (
    <div className="flex flex-col gap-4 p-1">
      <Label>
        Personal node menu trigger
        <Description
          description={
            "Override the global trigger for the discourse node menu. Must refresh after editing."
          }
        />
        <NodeMenuTriggerComponent extensionAPI={extensionAPI} />
      </Label>
      <Label>
        Node search menu trigger
        <Description
          description={
            "Set the trigger character for the node search menu. Must refresh after editing."
          }
        />
        <NodeSearchMenuTriggerSetting onloadArgs={onloadArgs} />
      </Label>
      <KeyboardShortcutInput
        onloadArgs={onloadArgs}
        settingKey={DISCOURSE_TOOL_SHORTCUT_KEY}
        label="Discourse tool keyboard shortcut"
        description="Set a single key to activate the discourse tool in tldraw. Only single keys (no modifiers) are supported. Leave empty for no shortcut."
        placeholder="Click to set single key"
      />
      <PersonalFlagPanel
        title="Overlay"
        description="Whether or not to overlay Discourse Context information over Discourse Node references."
        settingKeys={["Discourse Context Overlay"]}
        onChange={(checked) => {
          onPageRefObserverChange(overlayHandler)(checked);
        }}
      />
      {suggestiveModeEnabled && (
        <PersonalFlagPanel
          title="Suggestive Mode Overlay"
          description="Whether or not to overlay Suggestive Mode button over Discourse Node references."
          settingKeys={["Suggestive Mode Overlay"]}
          onChange={(checked) => {
            onPageRefObserverChange(getSuggestiveOverlayHandler(onloadArgs))(
              checked,
            );
          }}

        />
      )}
      <PersonalFlagPanel
        title="Text Selection Popup"
        description="Whether or not to show the Discourse Node Menu when selecting text."
        settingKeys={["Text Selection Popup"]}
        defaultValue={true}
      />
      <PersonalFlagPanel
        title="Disable Sidebar Open"
        description="Disable opening new nodes in the sidebar when created"
        settingKeys={["Disable Sidebar Open"]}
      />
      <PersonalFlagPanel
        title="Preview"
        description="Whether or not to display page previews when hovering over page refs"
        settingKeys={["Page Preview"]}
        onChange={(checked) => {
          onPageRefObserverChange(previewPageRefHandler)(checked);
        }}
      />
      <PersonalFlagPanel
        title="Hide Feedback Button"
        description="Hide the 'Send feedback' button at the bottom right of the screen."
        settingKeys={["Hide Feedback Button"]}
        onChange={(checked) => {
          if (checked) {
            hideDiscourseFloatingMenu();
          } else {
            showDiscourseFloatingMenu();
          }
        }}
      />
      <PersonalFlagPanel
        title="Auto Canvas Relations"
        description="Automatically add discourse relations to canvas when a node is added"
        settingKeys={["Auto Canvas Relations"]}
      />

      <PersonalFlagPanel
        title="(BETA) Overlay in Canvas"
        description="Whether or not to overlay Discourse Context information over Canvas Nodes."
        settingKeys={["Overlay in Canvas"]}
      />
      <PersonalFlagPanel
        title="Streamline Styling"
        description="Apply streamlined styling to your personal graph for a cleaner appearance."
        settingKeys={["Streamline Styling"]}
        onChange={(checked) => {
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
        title="Disable Product Diagnostics"
        description="Disable sending usage signals and error reports that help us improve the product."
        settingKeys={["Disable Product Diagnostics"]}
        onChange={(checked) => {
          if (checked) {
            disablePostHog();
          } else {
            enablePostHog();
          }
        }}
      />
    </div>
  );
};

export default HomePersonalSettings;
