import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label, Checkbox } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { NodeMenuTriggerComponent } from "../DiscourseNodeMenu";
import {
  getOverlayHandler,
  onPageRefObserverChange,
  previewPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import { hideFeedbackButton, showFeedbackButton } from "../BirdEatsBugs";

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
            hideFeedbackButton();
          } else {
            showFeedbackButton();
          }

          if (
            !document.getElementById("birdeatsbug-default-button") &&
            !document.getElementById("feedback-button-hiding-styles")
          ) {
            alert(
              "Please refresh the page for this change to take full effect.",
            );
          }
        }}
        labelElement={
          <>
            Hide Feedback Button
            <Description
              description={
                "Hide the 'Send feedback' button at the bottom right of the screen. Changes take full effect after page refresh."
              }
            />
          </>
        }
      />
    </div>
  );
};

export default HomePersonalSettings;
