import getBlockProps from "~/utils/getBlockProps";
import getBlockUidByTextOnPage from "roamjs-components/queries/getBlockUidByTextOnPage";
import setBlockProps from "./setBlockProps";

export const DG_BLOCK_PROP_SETTINGS_PAGE_TITLE =
  "roam/js/discourse-graph/block-prop-settings";
type json = string | number | boolean | null | json[] | { [key: string]: json };

export const TOP_LEVEL_BLOCK_PROP_KEYS = { featureFlags: "Feature Flags" };

export const getBlockPropSettings = ({
  keys,
}: {
  keys: string[];
}): { blockProps: json | undefined; blockUid: string } => {
  const sectionKey = keys[0];

  const blockUid = getBlockUidByTextOnPage({
    text: sectionKey,
    title: DG_BLOCK_PROP_SETTINGS_PAGE_TITLE,
  });

  const allSectionBlockProps = getBlockProps(blockUid);

  if (keys.length > 1) {
    const propertyPath = keys.slice(1);

    const targetValue = propertyPath.reduce<json | undefined>(
      (currentContext, currentKey) => {
        if (
          currentContext &&
          typeof currentContext === "object" &&
          !Array.isArray(currentContext)
        ) {
          return (currentContext as Record<string, json>)[currentKey];
        }
        return undefined;
      },
      allSectionBlockProps,
    );
    return { blockProps: targetValue, blockUid };
  }
  console.log("all section block props", keys, allSectionBlockProps);
  return { blockProps: allSectionBlockProps, blockUid };
};

export const setBlockPropSettings = ({
  keys,
  value,
}: {
  keys: string[];
  value: json;
}) => {
  console.log("setting block prop settings", keys, value);
  const { blockProps: currentProps, blockUid } = getBlockPropSettings({
    keys: [keys[0]],
  }) || { blockProps: {}, blockUid: "" };
  console.log("current props", currentProps);

  const newProps = JSON.parse(JSON.stringify(currentProps || {})) as Record<
    string,
    json
  >;

  if (keys && keys.length > 1) {
    const propertyPath = keys.slice(1);
    const lastKeyIndex = propertyPath.length - 1;

    propertyPath.reduce((currentContext, currentKey, index) => {
      const contextRecord = currentContext;

      if (index === lastKeyIndex) {
        contextRecord[currentKey] = value;
        return contextRecord;
      }

      if (
        !contextRecord[currentKey] ||
        typeof contextRecord[currentKey] !== "object" ||
        Array.isArray(contextRecord[currentKey])
      ) {
        contextRecord[currentKey] = {};
      }

      return contextRecord[currentKey];
    }, newProps);
  } else {
    console.log("setting root block prop", value);
    newProps[keys[1]] = value;
  }
  console.log("new props", newProps);

  setBlockProps(blockUid, newProps, true);
};
