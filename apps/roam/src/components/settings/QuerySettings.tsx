import React from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label } from "@blueprintjs/core";
import Description from "~/components/settings/SettingsDescription";
import { DEFAULT_PAGE_SIZE_KEY, HIDE_METADATA_KEY } from "~/data/userSettings";
import DefaultFilters from "./DefaultFilters";
import {
  PersonalFlagPanel,
  PersonalNumberPanel,
  PersonalMultiTextPanel,
} from "./components/BlockPropSettingPanels";
import {
  PERSONAL_KEYS,
  QUERY_KEYS,
} from "~/components/settings/utils/settingKeys";
import { type SettingsSnapshot } from "./utils/accessors";
import posthog from "posthog-js";
import { ROAM_DOCS, withDocsLink } from "./utils/docs";

const QuerySettings = ({
  extensionAPI,
  personalSettings,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  personalSettings: SettingsSnapshot["personalSettings"];
}) => {
  const querySettings = personalSettings.Query;
  return (
    <div className="flex flex-col gap-4 p-1">
      <PersonalFlagPanel
        title="Hide query metadata"
        description={withDocsLink(
          "Hide the Roam blocks that are used to power each query",
          ROAM_DOCS.querying,
        )}
        settingKeys={[PERSONAL_KEYS.query, QUERY_KEYS.hideQueryMetadata]}
        initialValue={querySettings[QUERY_KEYS.hideQueryMetadata]}
        onChange={(checked) => {
          void extensionAPI.settings.set(HIDE_METADATA_KEY, checked);
          posthog.capture("Query Settings: Hide Metadata Toggled", {
            hidden: checked,
          });
        }}
      />
      <PersonalNumberPanel
        title="Default page size"
        description={withDocsLink(
          "The default page size used for query results",
          ROAM_DOCS.querying,
        )}
        settingKeys={[PERSONAL_KEYS.query, QUERY_KEYS.defaultPageSize]}
        initialValue={querySettings[QUERY_KEYS.defaultPageSize]}
        onChange={(value) => {
          void extensionAPI.settings.set(DEFAULT_PAGE_SIZE_KEY, value);
          posthog.capture("Query Settings: Default Page Size Changed", {
            value,
          });
        }}
      />
      <PersonalMultiTextPanel
        title="Query pages"
        description={withDocsLink(
          "The title formats of pages that you would like to serve as pages that generate queries",
          ROAM_DOCS.querying,
        )}
        settingKeys={[PERSONAL_KEYS.query, QUERY_KEYS.queryPages]}
        initialValue={querySettings[QUERY_KEYS.queryPages]}
        onChange={(values) => {
          void extensionAPI.settings.set("query-pages", values);
        }}
      />
      <Label>
        Default filters
        <Description
          description={withDocsLink(
            "Any filters that should be applied to your results by default",
            ROAM_DOCS.querying,
          )}
        />
        <DefaultFilters
          extensionAPI={extensionAPI}
          defaultFilters={querySettings[QUERY_KEYS.defaultFilters]}
        />
      </Label>
    </div>
  );
};

export default QuerySettings;
