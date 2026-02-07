import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { DEFAULT_PAGE_SIZE_KEY, HIDE_METADATA_KEY } from "~/data/userSettings";
import DefaultFilters from "./DefaultFilters";
import { getQueryPages } from "./QueryPagesPanel";
import {
  PersonalFlagPanel,
  PersonalNumberPanel,
  PersonalMultiTextPanel,
} from "./components/BlockPropSettingPanels";

const QuerySettings = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  return (
    <div className="flex flex-col gap-4 p-1">
      <PersonalFlagPanel
        title="Hide Query Metadata"
        description="Hide the Roam blocks that are used to power each query"
        settingKeys={["Query", "Hide Query Metadata"]}
        defaultValue={
          (extensionAPI.settings.get(HIDE_METADATA_KEY) as boolean) ?? true
        }
        onChange={(checked) => {
          void extensionAPI.settings.set(HIDE_METADATA_KEY, checked);
        }}
      />
      <PersonalNumberPanel
        title="Default Page Size"
        description="The default page size used for query results"
        settingKeys={["Query", "Default Page Size"]}
        defaultValue={
          Number(extensionAPI.settings.get(DEFAULT_PAGE_SIZE_KEY)) || 10
        }
        onChange={(value) => {
          void extensionAPI.settings.set(DEFAULT_PAGE_SIZE_KEY, value);
        }}
      />
      <PersonalMultiTextPanel
        title="Query Pages"
        description="The title formats of pages that you would like to serve as pages that generate queries"
        settingKeys={["Query", "Query Pages"]}
        defaultValue={getQueryPages(extensionAPI)}
        onChange={(values) => {
          void extensionAPI.settings.set("query-pages", values);
        }}
      />
      <Label>
        Default Filters
        <Description
          description={
            "Any filters that should be applied to your results by default"
          }
        />
        <DefaultFilters extensionAPI={extensionAPI} />
      </Label>
    </div>
  );
};

export default QuerySettings;
