import React, { useState, useMemo } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label, InputGroup } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "~/index";
import { NodeMenuTriggerComponent } from "../DiscourseNodeMenu";

const CANVAS_PAGE_FORMAT_KEY = "canvas-page-format";
const HomePersonalSettings = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs[`extensionAPI`];
}) => {
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
          description={"The personal trigger to create the node menu."}
        />
        <NodeMenuTriggerComponent extensionAPI={extensionAPI} />
      </Label>
    </div>
  );
};

export default HomePersonalSettings;
