import React, { useState, useMemo } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label, InputGroup, Checkbox } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import { NodeMenuTriggerComponent } from "../DiscourseNodeMenu";
import {
  getOverlayHandler,
  onPageRefObserverChange,
} from "~/utils/pageRefObserverHandlers";
import {} from "~/utils/pageRefObserverHandlers";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import { previewPageRefHandler } from "~/utils/pageRefObserverHandlers";
import refreshConfigTree from "~/utils/refreshConfigTree";

const CANVAS_PAGE_FORMAT_KEY = "canvas-page-format";
const HomePersonalSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const getInitCanvasPage = () => {
    const savedFormat = extensionAPI.settings.get(
      CANVAS_PAGE_FORMAT_KEY,
    ) as string;
    return savedFormat || DEFAULT_CANVAS_PAGE_FORMAT;
  };
  const [canvasPage, setCanvasPage] = useState(getInitCanvasPage);
  const handleSetCanvasPage = (e: string) => {
    extensionAPI.settings.set(CANVAS_PAGE_FORMAT_KEY, e);
    setCanvasPage(e);
  };
  const overlayHandler = getOverlayHandler(onloadArgs);

  const settings = useMemo(() => {
    refreshConfigTree();
    return getFormattedConfigTree();
  }, []);

  return (
    <div className="flex flex-col gap-4 p-1">
      <Label>
        Canvas Page Format
        <Description description={"The page format for canvas pages"} />
        <InputGroup
          value={canvasPage}
          onChange={(e) => handleSetCanvasPage(e.target.value)}
        />
      </Label>
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
      <FlagPanel
        title="disable sidebar open"
        description="Disable opening new nodes in the sidebar when created"
        order={1}
        uid={settings.disableSidebarOpen.uid}
        parentUid={settings.settingsUid}
        value={settings.disableSidebarOpen.value || false}
      />
      <FlagPanel
        title="preview"
        description="Whether or not to display page previews when hovering over page refs"
        order={2}
        uid={settings.preview.uid}
        parentUid={settings.settingsUid}
        value={settings.preview.value || false}
        options={{
          onChange: onPageRefObserverChange(previewPageRefHandler),
        }}
      />
    </div>
  );
};

export default HomePersonalSettings;
