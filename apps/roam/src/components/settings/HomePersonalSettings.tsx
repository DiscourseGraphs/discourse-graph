import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label, Checkbox } from "@blueprintjs/core";
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
  AUTO_CANVAS_RELATIONS_KEY,
  DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
  DISCOURSE_TOOL_SHORTCUT_KEY,
  STREAMLINE_STYLING_KEY,
} from "~/data/userSettings";
import KeyboardShortcutInput from "./KeyboardShortcutInput";
import { getSetting, setSetting } from "~/utils/extensionSettings";
import streamlineStyling from "~/styles/streamlineStyling";

const HomePersonalSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const overlayHandler = getOverlayHandler(onloadArgs);

  return (
    <div className="flex flex-col gap-4 p-1">
      <Label>
        Personal Node Menu Trigger
        <Description
          description={
            "Override the global trigger for the Discourse Node Menu. Must refresh after editing."
          }
        />
        <NodeMenuTriggerComponent extensionAPI={extensionAPI} />
      </Label>
      <Label>
        Node Search Menu Trigger
        <Description
          description={
            "Set the trigger character for the Node Search Menu. Must refresh after editing."
          }
        />
        <NodeSearchMenuTriggerSetting onloadArgs={onloadArgs} />
      </Label>
      <KeyboardShortcutInput
        onloadArgs={onloadArgs}
        settingKey={DISCOURSE_TOOL_SHORTCUT_KEY}
        label="Discourse Tool Keyboard Shortcut"
        description="Set a single key to activate the Discourse Tool in tldraw. Only single keys (no modifiers) are supported. Leave empty for no shortcut."
        placeholder="Click to set single key..."
      />
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("discourse-context-overlay") as boolean
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set(
            "discourse-context-overlay",
            target.checked,
          );

          onPageRefObserverChange(overlayHandler)(target.checked);
        }}
        labelElement={
          <>
            Overlay
            <Description
              description={
                "Whether or not to overlay Discourse Context information over Discourse Node references."
              }
            />
          </>
        }
      />
      {/*
      TODO: Add back in when we have better flow for suggestive mode, until then this is enabled for all
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("suggestive-mode-overlay") as boolean
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          void extensionAPI.settings.set(
            "suggestive-mode-overlay",
            target.checked,
          );
          onPageRefObserverChange(getSuggestiveOverlayHandler(onloadArgs))(
            target.checked,
          );
        }}
        labelElement={
          <>
            Suggestive Mode Overlay
            <Description
              description={
                "Whether or not to overlay Suggestive Mode button over Discourse Node references."
              }
            />
          </>
        }
      />
      */}
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("text-selection-popup") !== false
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set("text-selection-popup", target.checked);
        }}
        labelElement={
          <>
            Text Selection Popup
            <Description
              description={
                "Whether or not to show the Discourse Node Menu when selecting text."
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("disable-sidebar-open") as boolean
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set("disable-sidebar-open", target.checked);
        }}
        labelElement={
          <>
            Disable Sidebar Open
            <Description
              description={
                "Disable opening new nodes in the sidebar when created"
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={extensionAPI.settings.get("page-preview") as boolean}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set("page-preview", target.checked);
          onPageRefObserverChange(previewPageRefHandler)(target.checked);
        }}
        labelElement={
          <>
            Preview
            <Description
              description={
                "Whether or not to display page previews when hovering over page refs"
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("hide-feedback-button") as boolean
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set("hide-feedback-button", target.checked);

          if (target.checked) {
            hideDiscourseFloatingMenu();
          } else {
            showDiscourseFloatingMenu();
          }
        }}
        labelElement={
          <>
            Hide Feedback Button
            <Description
              description={
                "Hide the 'Send feedback' button at the bottom right of the screen."
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get(AUTO_CANVAS_RELATIONS_KEY) === true
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          void extensionAPI.settings.set(
            AUTO_CANVAS_RELATIONS_KEY,
            target.checked,
          );
        }}
        labelElement={
          <>
            Auto Canvas Relations
            <Description
              description={
                "Automatically add discourse relations to canvas when a node is added"
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={getSetting(
          DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
          false,
        )}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setSetting(DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY, target.checked);
        }}
        labelElement={
          <>
            (BETA) Overlay in Canvas
            <Description
              description={
                "Whether or not to overlay Discourse Context information over Canvas Nodes."
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={getSetting(STREAMLINE_STYLING_KEY, false)}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setSetting(STREAMLINE_STYLING_KEY, target.checked);

          // Load or unload the streamline styling
          const existingStyleElement =
            document.getElementById("streamline-styling");

          if (target.checked && !existingStyleElement) {
            // Load the styles
            const styleElement = addStyle(streamlineStyling);
            styleElement.id = "streamline-styling";
          } else if (!target.checked && existingStyleElement) {
            // Unload the styles
            existingStyleElement.remove();
          }
        }}
        labelElement={
          <>
            Streamline Styling
            <Description
              description={
                "Apply streamlined styling to your personal graph for a cleaner appearance."
              }
            />
          </>
        }
      />
    </div>
  );
};

export default HomePersonalSettings;
