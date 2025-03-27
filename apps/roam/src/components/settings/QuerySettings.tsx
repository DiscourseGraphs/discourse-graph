import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label, NumericInput, Checkbox } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { getSettings } from "~/utils/parseResultSettings";
import { DEFAULT_PAGE_SIZE_KEY, HIDE_METADATA_KEY } from "~/data/userSettings";
import DefaultFilters from "./DefaultFilters";
import QueryPagesPanel from "./QueryPagesPanel";

const QuerySettings = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const { globalPageSize } = getSettings(extensionAPI);
  return (
    <div className="flex flex-col gap-4 p-1">
      <Checkbox
        defaultChecked={extensionAPI.settings.get(HIDE_METADATA_KEY) as boolean}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set(HIDE_METADATA_KEY, target.checked);
        }}
        labelElement={
          <>
            Hide Query Metadata
            <Description
              description={
                "Hide the Roam blocks that are used to power each query"
              }
            />
          </>
        }
      />
      <Label>
        Default Page Size
        <Description
          description={"The default page size used for query results"}
        />
        <NumericInput
          defaultValue={globalPageSize.toString()}
          onValueChange={(value) =>
            extensionAPI.settings.set(DEFAULT_PAGE_SIZE_KEY, value)
          }
        />
      </Label>
      <Label>
        Query Pages
        <Description
          description={
            "The title formats of pages that you would like to serve as pages that generate queries"
          }
        />
        <QueryPagesPanel extensionAPI={extensionAPI} />
      </Label>
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
