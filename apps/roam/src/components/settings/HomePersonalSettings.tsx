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
import {
  DISCOURSE_TOOL_SHORTCUT_KEY,
  AUTO_CANVAS_RELATIONS_KEY,
  DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
  STREAMLINE_STYLING_KEY,
  DISALLOW_DIAGNOSTICS,
} from "~/data/userSettings";
import { setSetting } from "~/utils/extensionSettings";
import { enablePostHog, disablePostHog } from "~/utils/posthog";
import KeyboardShortcutInput from "./KeyboardShortcutInput";
import streamlineStyling from "~/styles/streamlineStyling";
import { getFeatureFlag } from "~/components/settings/utils/accessors";
import { PersonalFlagPanel } from "./components/BlockPropSettingPanels";
import { PERSONAL_KEYS } from "./utils/settingKeys";
import posthog from "posthog-js";

const HomePersonalSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const overlayHandler = getOverlayHandler(onloadArgs);

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
        blockPropKey={PERSONAL_KEYS.discourseToolShortcut}
        label="Discourse tool keyboard shortcut"
        description="Set a single key to activate the discourse tool in tldraw. Only single keys (no modifiers) are supported. Leave empty for no shortcut."
        placeholder="Click to set single key"
      />
      <PersonalFlagPanel
        title="Overlay"
        description="Whether or not to overlay discourse context information over discourse node references."
        settingKeys={[PERSONAL_KEYS.discourseContextOverlay]}
        onChange={(checked) => {
          void setSetting("discourse-context-overlay", checked);
          onPageRefObserverChange(overlayHandler)(checked);
          posthog.capture("Personal Settings: Overlay Toggled", {
            enabled: checked,
          });
        }}
      />
      {getFeatureFlag("Suggestive mode enabled") && (
        <PersonalFlagPanel
          title="Suggestive mode overlay"
          description="Whether or not to overlay suggestive mode button over discourse node references."
          settingKeys={[PERSONAL_KEYS.suggestiveModeOverlay]}
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
        settingKeys={[PERSONAL_KEYS.textSelectionPopup]}
        onChange={(checked) => {
          void setSetting("text-selection-popup", checked);
        }}
      />
      <PersonalFlagPanel
        title="Disable sidebar open"
        description="Disable opening new nodes in the sidebar when created"
        settingKeys={[PERSONAL_KEYS.disableSidebarOpen]}
        onChange={(checked) => {
          void setSetting("disable-sidebar-open", checked);
        }}
      />
      <PersonalFlagPanel
        title="Page preview"
        description="Whether or not to display page previews when hovering over page refs"
        settingKeys={[PERSONAL_KEYS.pagePreview]}
        onChange={(checked) => {
          void setSetting("page-preview", checked);
          onPageRefObserverChange(previewPageRefHandler)(checked);
        }}
      />
      <PersonalFlagPanel
        title="Hide feedback button"
        description="Hide the 'Send feedback' button at the bottom right of the screen."
        settingKeys={[PERSONAL_KEYS.hideFeedbackButton]}
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
        settingKeys={[PERSONAL_KEYS.autoCanvasRelations]}
        onChange={(checked) => {
          void setSetting(AUTO_CANVAS_RELATIONS_KEY, checked);
        }}
      />

      <PersonalFlagPanel
        title="(BETA) Overlay in canvas"
        description="Whether or not to overlay discourse context information over canvas nodes."
        settingKeys={[PERSONAL_KEYS.overlayInCanvas]}
        onChange={(checked) => {
          void setSetting(DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY, checked);
        }}
      />
      <PersonalFlagPanel
        title="Streamline styling"
        description="Apply streamlined styling to your personal graph for a cleaner appearance."
        settingKeys={[PERSONAL_KEYS.streamlineStyling]}
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
        settingKeys={[PERSONAL_KEYS.disableProductDiagnostics]}
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
