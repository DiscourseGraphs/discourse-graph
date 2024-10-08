import { OnloadArgs } from "roamjs-components/types";
import { DefaultFilters, QueryPagesPanel } from "~/components";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";

export const createSettingsPanel = (
  extensionAPI: OnloadArgs["extensionAPI"]
) => {
  extensionAPI.settings.panel.create({
    tabTitle: "Query Builder",
    settings: [
      {
        id: "query-pages",
        name: "Query Pages",
        description:
          "The title formats of pages that you would like to serve as pages that generate queries",
        action: {
          type: "reactComponent",
          component: QueryPagesPanel(extensionAPI),
        },
      },
      {
        id: "hide-metadata",
        name: "Hide Query Metadata",
        description: "Hide the Roam blocks that are used to power each query",
        action: {
          type: "switch",
        },
      },
      {
        id: "default-filters",
        name: "Default Filters",
        description:
          "Any filters that should be applied to your results by default",
        action: {
          type: "reactComponent",
          component: DefaultFilters(extensionAPI),
        },
      },
      {
        id: "default-page-size",
        name: "Default Page Size",
        description: "The default page size used for query results",
        action: {
          type: "input",
          placeholder: "10",
        },
      },
      {
        id: "canvas-page-format",
        name: "Canvas Page Format",
        description: "The page format for canvas pages",
        action: {
          type: "input",
          placeholder: DEFAULT_CANVAS_PAGE_FORMAT,
        },
      },
    ],
  });
};
