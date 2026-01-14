import React, { useMemo } from "react";
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
import {
  DISCOURSE_TOOL_SHORTCUT_KEY,
  AUTO_CANVAS_RELATIONS_KEY,
  DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
  STREAMLINE_STYLING_KEY,
  DISALLOW_DIAGNOSTICS,
} from "~/data/userSettings";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import { enablePostHog, disablePostHog } from "~/utils/posthog";
import KeyboardShortcutInput from "./KeyboardShortcutInput";
import streamlineStyling from "~/styles/streamlineStyling";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import { PersonalFlagPanel } from "./components/BlockPropSettingPanels";

const HomePersonalSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const overlayHandler = getOverlayHandler(onloadArgs);
  const settings = useMemo(() => getFormattedConfigTree(), []);

  return (
    <div className="flex flex-col gap-4 p-1">
      <Label>
        Personal node menu trigger
        <Description
          description={
            "Override the global trigger for the discourse node menu. Must refresh after editing."
          }
        />
        <NodeMenuTriggerComponent extensionAPI={onloadArgs.extensionAPI} />
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
      />
      <PersonalFlagPanel
        title="Overlay"
        description="Whether or not to overlay discourse context information over discourse node references."
        settingKeys={["Discourse context overlay"]}
        initialValue={getSetting<boolean>("discourse-context-overlay", false)}
        onChange={(checked) => {
          void setSetting("discourse-context-overlay", checked);
          onPageRefObserverChange(overlayHandler)(checked);
        }}
      />
      {settings.suggestiveModeEnabled?.value && (
        <PersonalFlagPanel
          title="Suggestive mode overlay"
          description="Whether or not to overlay suggestive mode button over discourse node references."
          settingKeys={["Suggestive mode overlay"]}
          initialValue={getSetting<boolean>("suggestive-mode-overlay", false)}
          onChange={(checked) => {
            void setSetting("suggestive-mode-overlay", checked);
            onPageRefObserverChange(getSuggestiveOverlayHandler(onloadArgs))(
              checked,
            );
          }}
        />
      )}
      <PersonalFlagPanel
        title="Text selection popup"
        description="Whether or not to show the discourse node menu when selecting text."
        settingKeys={["Text selection popup"]}
        initialValue={getSetting("text-selection-popup", true)}
        onChange={(checked) => {
          void setSetting("text-selection-popup", checked);
        }}
      />
      <PersonalFlagPanel
        title="Disable sidebar open"
        description="Disable opening new nodes in the sidebar when created"
        settingKeys={["Disable sidebar open"]}
        initialValue={getSetting<boolean>("disable-sidebar-open", false)}
        onChange={(checked) => {
          void setSetting("disable-sidebar-open", checked);
        }}
      />
      <PersonalFlagPanel
        title="Page preview"
        description="Whether or not to display page previews when hovering over page refs"
        settingKeys={["Page preview"]}
        initialValue={getSetting<boolean>("page-preview", false)}
        onChange={(checked) => {
          void setSetting("page-preview", checked);
          onPageRefObserverChange(previewPageRefHandler)(checked);
        }}
      />
      <PersonalFlagPanel
        title="Hide feedback button"
        description="Hide the 'Send feedback' button at the bottom right of the screen."
        settingKeys={["Hide feedback button"]}
        initialValue={getSetting<boolean>("hide-feedback-button", false)}
        onChange={(checked) => {
          void setSetting("hide-feedback-button", checked);
          if (checked) {
            hideDiscourseFloatingMenu();
          } else {
            showDiscourseFloatingMenu();
          }
        }}
      />
      <PersonalFlagPanel
        title="Auto canvas relations"
        description="Automatically add discourse relations to canvas when a node is added"
        settingKeys={["Auto canvas relations"]}
        initialValue={getSetting<boolean>(AUTO_CANVAS_RELATIONS_KEY, false)}
        onChange={(checked) => {
          void setSetting(AUTO_CANVAS_RELATIONS_KEY, checked);
        }}
      />

      <PersonalFlagPanel
        title="(BETA) Overlay in canvas"
        description="Whether or not to overlay discourse context information over canvas nodes."
        settingKeys={["Overlay in canvas"]}
        initialValue={getSetting<boolean>(
          DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
          false,
        )}
        onChange={(checked) => {
          void setSetting(DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY, checked);
        }}
      />
      <PersonalFlagPanel
        title="Streamline styling"
        description="Apply streamlined styling to your personal graph for a cleaner appearance."
        settingKeys={["Streamline styling"]}
        initialValue={getSetting<boolean>(STREAMLINE_STYLING_KEY, false)}
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
        title="Disable product diagnostics"
        description="Disable sending usage signals and error reports that help us improve the product."
        settingKeys={["Disable product diagnostics"]}
        initialValue={getSetting<boolean>(DISALLOW_DIAGNOSTICS, false)}
        onChange={(checked) => {
          void setSetting(DISALLOW_DIAGNOSTICS, checked);
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
