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
import posthog from "posthog-js";

const QuerySettings = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  return (
    <div className="flex flex-col gap-4 p-1">
      <PersonalFlagPanel
        title="Hide query metadata"
        description="Hide the Roam blocks that are used to power each query"
        settingKeys={["Query", "Hide query metadata"]}
        initialValue={
          (extensionAPI.settings.get(HIDE_METADATA_KEY) as boolean) ?? true
        }
        onChange={(checked) => {
          void extensionAPI.settings.set(HIDE_METADATA_KEY, checked);
          posthog.capture("Query Settings: Hide Metadata Toggled", {
            hidden: checked,
          });
        }}
      />
      <PersonalNumberPanel
        title="Default page size"
        description="The default page size used for query results"
        settingKeys={["Query", "Default page size"]}
        initialValue={
          Number(extensionAPI.settings.get(DEFAULT_PAGE_SIZE_KEY)) || 10
        }
        onChange={(value) => {
          void extensionAPI.settings.set(DEFAULT_PAGE_SIZE_KEY, value);
          posthog.capture("Query Settings: Default Page Size Changed", {
            value,
          });
        }}
      />
      <PersonalMultiTextPanel
        title="Query pages"
        description="The title formats of pages that you would like to serve as pages that generate queries"
        settingKeys={["Query", "Query pages"]}
        initialValue={getQueryPages(extensionAPI)}
        onChange={(values) => {
          void extensionAPI.settings.set("query-pages", values);
        }}
      />
      <Label>
        Default filters
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
