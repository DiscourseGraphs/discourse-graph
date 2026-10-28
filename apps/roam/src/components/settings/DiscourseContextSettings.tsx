import React, { useState } from "react";
import { Card, Collapse, HTMLSelect, Label } from "@blueprintjs/core";
import {
  DiscourseContextButton,
  DiscourseContextOverlayContent,
} from "~/components/DiscourseContextOverlay";
import {
  DISCOURSE_CONTEXT_PREVIEW_NODES,
  getDiscourseContextPreview,
  getDiscourseContextPreviewLabel,
  type DiscourseContextPreviewNode,
} from "~/data/discourseContextPreview";
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
  const [selectedNode, setSelectedNode] =
    useState<DiscourseContextPreviewNode>("claim");
  const [previewOpen, setPreviewOpen] = useState(true);
  const preview = getDiscourseContextPreview(selectedNode);
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
      <Card className="min-w-0">
        <h4 className="bp3-heading">Try discourse context</h4>
        <p>
          Explore the example below before enabling the overlay. This sample
          stays here and does not add pages or relations to your graph.
        </p>
        <Label>
          Example node
          <HTMLSelect
            fill
            value={selectedNode}
            onChange={(event) =>
              setSelectedNode(event.target.value as DiscourseContextPreviewNode)
            }
            options={Object.keys(DISCOURSE_CONTEXT_PREVIEW_NODES).map(
              (node) => ({
                value: node,
                label: getDiscourseContextPreviewLabel(
                  node as DiscourseContextPreviewNode,
                ),
              }),
            )}
          />
        </Label>
        <DiscourseContextButton
          id="dg-discourse-context-preview"
          loading={false}
          score={preview.score}
          refs={preview.refs}
          onClick={() => setPreviewOpen((open) => !open)}
        />
        <p className="text-sm">
          The tree icon counts {preview.score} discourse relations, the default
          discourse score. The link icon counts {preview.refs} references to
          this node. Click the overlay to show or hide its relations.
        </p>
        <Collapse isOpen={previewOpen}>
          <DiscourseContextOverlayContent
            key={selectedNode}
            uid={`dg-preview-${selectedNode}`}
            results={preview.results}
            preview
          />
        </Collapse>
        <p className="text-sm">
          On the first Claim example, select Supported By and turn on Group By
          Target to compare the supporting claim and evidence. These are
          fictional examples.
        </p>
      </Card>
    </div>
  );
};

export default DiscourseContextSettings;
