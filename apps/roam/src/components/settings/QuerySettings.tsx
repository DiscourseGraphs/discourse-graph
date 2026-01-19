import React from "react";
import { Label } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import DefaultFilters from "./DefaultFilters";
import {
  PersonalFlagPanel,
  PersonalNumberPanel,
  PersonalMultiTextPanel,
} from "./components/BlockPropSettingPanels";

const QuerySettings = () => {
  return (
    <div className="flex flex-col gap-4 p-1">
      <PersonalFlagPanel
        title="Hide Query Metadata"
        description="Hide the Roam blocks that are used to power each query"
        settingKeys={["Query", "Hide Query Metadata"]}
        defaultValue={false}
      />
      <PersonalNumberPanel
        title="Default Page Size"
        description="The default page size used for query results"
        settingKeys={["Query", "Default Page Size"]}
        defaultValue={10}
        min={1}
      />
      <PersonalMultiTextPanel
        title="Query Pages"
        description="The title formats of pages that you would like to serve as pages that generate queries"
        settingKeys={["Query", "Query Pages"]}
        defaultValue={[]}
      />
      <Label>
        Default Filters
        <Description
          description={
            "Any filters that should be applied to your results by default"
          }
        />
        <DefaultFilters />
      </Label>
    </div>
  );
};

export default QuerySettings;
