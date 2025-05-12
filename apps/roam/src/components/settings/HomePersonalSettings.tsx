import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label, Checkbox, Button, Intent } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { NodeMenuTriggerComponent } from "~/components/DiscourseNodeMenu";
import {
  getOverlayHandler,
  onPageRefObserverChange,
  previewPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import {
  hideFeedbackButton,
  showFeedbackButton,
} from "~/components/BirdEatsBugs";
import { runFullEmbeddingProcess } from "~/utils/embeddingWorkflow";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { getAllDiscourseNodes } from "~/utils/embeddingWorkflow";
import {
  getEmbeddingsService,
  NodeWithEmbedding,
} from "~/utils/embeddingService";
import getDiscourseRelations from "~/utils/getDiscourseRelations";

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
      <Label>
        Supabase Embeddings
        <Description
          description={
            "Extract all text nodes from the current Roam graph, generate embeddings, and upload to Supabase. Process runs in background; check console for progress."
          }
        />
        <Button
          icon="cloud-upload"
          text="Generate & Upload All Node Embeddings"
          onClick={async () => {
            console.log("get discourse relations", getDiscourseRelations());
            console.log("handleGenerateEmbeddings: Starting process.");
            // const allNodes = await getAllDiscourseNodes();
            //const nodes = allNodes.slice(0, 101); // Take only the first 101 nodes
            //console.log("Discourse nodes (first 101):", nodes);
            // const nodesWithEmbeddings = await getEmbeddingsService(nodes);
            // console.log("Nodes with embeddings:", nodesWithEmbeddings);
            // Next: send nodesWithEmbeddings to Supabase
            await runFullEmbeddingProcess();
          }}
          intent={Intent.PRIMARY}
          style={{ marginTop: "8px" }}
        />
      </Label>
    </div>
  );
};

export default HomePersonalSettings;
