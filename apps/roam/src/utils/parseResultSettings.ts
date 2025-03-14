import { Filters } from "roamjs-components/components/Filter";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { OnloadArgs, RoamBasicNode } from "roamjs-components/types/native";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import { StoredFilters } from "~/components/settings/DefaultFilters";
import { Column } from "./types";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSettingValuesFromTree from "roamjs-components/util/getSettingValuesFromTree";
import {
  DEFAULT_FILTERS_KEY,
  DEFAULT_PAGE_SIZE_KEY,
} from "~/data/userSettings";

export type Sorts = { key: string; descending: boolean }[];
export type InputValues = {
  uid: string;
  key: string;
  inputValue: string;
  options: string;
}[];
export type FilterData = Record<string, Filters>;
export type Views = {
  column: string;
  mode: string;
  value: string;
}[];

const getFilterEntries = (
  n: Pick<RoamBasicNode, "children">,
): [string, Filters][] =>
  n.children.map((c) => [
    c.text,
    {
      includes: {
        values: new Set(
          getSubTree({ tree: c.children, key: "includes" }).children.map(
            (t) => t.text,
          ),
        ),
      },
      excludes: {
        values: new Set(
          getSubTree({ tree: c.children, key: "excludes" }).children.map(
            (t) => t.text,
          ),
        ),
      },
      uid: c.uid,
    },
  ]);

export const getSettings = (extensionAPI?: OnloadArgs["extensionAPI"]) => {
  return {
    globalFiltersData: Object.fromEntries(
      Object.entries(
        (extensionAPI?.settings.get(DEFAULT_FILTERS_KEY) as Record<
          string,
          StoredFilters
        >) || {},
      ).map(([k, v]) => [
        k,
        {
          includes: Object.fromEntries(
            Object.entries(v.includes || {}).map(([k, v]) => [k, new Set(v)]),
          ),
          excludes: Object.fromEntries(
            Object.entries(v.excludes || {}).map(([k, v]) => [k, new Set(v)]),
          ),
        },
      ]),
    ),
    globalPageSize:
      Number(extensionAPI?.settings.get(DEFAULT_PAGE_SIZE_KEY)) || 10,
  };
};

const parseResultSettings = (
  // TODO - this should be the resultNode uid
  parentUid: string,
  columns: Column[],
  extensionAPI?: OnloadArgs["extensionAPI"],
) => {
  const { globalFiltersData, globalPageSize } = getSettings(extensionAPI);
  const tree = getBasicTreeByParentUid(parentUid);
  const resultNode = getSubTree({ tree, key: "results" });
  const sortsNode = getSubTree({ tree: resultNode.children, key: "sorts" });
  const filtersNode = getSubTree({ tree: resultNode.children, key: "filters" });
  const columnFiltersNode = getSubTree({
    tree: resultNode.children,
    key: "columnFilters",
  });
  const searchFilterNode = getSubTree({
    tree: resultNode.children,
    key: "searchFilter",
  });
  const interfaceNode = getSubTree({
    tree: resultNode.children,
    key: "interface",
  });
  const filterEntries = getFilterEntries(filtersNode);
  const savedFilterData = filterEntries.length
    ? Object.fromEntries(filterEntries)
    : globalFiltersData;
  const random = getSettingIntFromTree({
    tree: resultNode.children,
    key: "random",
  });
  const pageSize =
    getSettingIntFromTree({ tree: resultNode.children, key: "size" }) ||
    globalPageSize;
  const viewsNode = getSubTree({ tree: resultNode.children, key: "views" });
  const savedViewData = Object.fromEntries(
    viewsNode.children.map((c) => [
      c.text,
      {
        mode: c.children[0]?.text,
        value: c.children[0]?.children?.[0]?.text || "",
      },
    ]),
  );
  const layoutNode = getSubTree({
    tree: resultNode.children,
    key: "layout",
  });
  const layout = Object.fromEntries(
    layoutNode.children
      .filter((c) => c.children.length)
      .map((c) => [
        c.text,
        c.children.length === 1
          ? c.children[0].text
          : c.children.map((cc) => cc.text),
      ]),
  );
  if (!layout.mode)
    layout.mode =
      layoutNode.children[0]?.children.length === 0
        ? layoutNode.children[0].text
        : "table";
  layout.uid = layoutNode.uid;
  const inputsNode = getSubTree({ tree: resultNode.children, key: "inputs" });
  const inputs: InputValues = inputsNode.children.map((c) => {
    const inputValue = getSettingValueFromTree({
      tree: c.children,
      key: "value",
    });
    const configNode = getSubTree({ tree: c.children, key: "config" });
    const options = getSettingValueFromTree({
      tree: configNode.children,
      key: "options",
    });

    return {
      uid: c.uid,
      key: c.text,
      inputValue,
      options: options.includes("<%") ? "smartblock" : options,
    };
  });
  const showInputsNode = getSubTree({
    tree: resultNode.children,
    key: "showInputs",
  });

  return {
    resultNodeUid: resultNode.uid,
    inputsNodeUid: inputsNode.uid,
    activeSort: sortsNode.children.map((s) => ({
      key: s.text,
      descending: toFlexRegex("true").test(s.children[0]?.text || ""),
    })),
    searchFilter: searchFilterNode.children[0]?.text,
    showInterface: interfaceNode.children[0]?.text !== "hide",
    filters: Object.fromEntries(
      columns.map(({ key }) => [
        key,
        savedFilterData[key] || {
          includes: { values: new Set<string>() },
          excludes: { values: new Set<string>() },
        },
      ]),
    ),
    columnFilters: columnFiltersNode.children.map((c) => {
      return {
        key: c.text,
        uid: c.uid,
        value: getSettingValuesFromTree({ tree: c.children, key: "value" }),
        type: getSettingValueFromTree({ tree: c.children, key: "type" }),
      };
    }),
    views: columns.map(({ key: column }) => ({
      column,
      mode:
        savedViewData[column]?.mode || (column === "text" ? "link" : "plain"),
      value: savedViewData[column]?.value || "",
    })),
    random,
    pageSize,
    layout,
    page: 1, // TODO save in roam data
    inputs,
    showInputs: showInputsNode.children[0]?.text === "show",
  };
};

export default parseResultSettings;
