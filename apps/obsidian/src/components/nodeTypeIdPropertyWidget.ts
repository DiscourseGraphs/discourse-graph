import type {
  AppWithUnofficialApis,
  PropertyWidget,
  PropertyWidgetComponentBase,
} from "~/utils/obsidianUnofficialTypes";
import type DiscourseGraphPlugin from "~/index";
import { getNodeTypeById } from "~/utils/typeUtils";

export const NODE_TYPE_ID_PROPERTY_KEY = "nodeTypeId";
const WIDGET_TYPE = "dg-node-type-id";

type NodeTypeIdPropertyWidgetComponent = PropertyWidgetComponentBase;

type NodeTypeIdPropertyWidget =
  PropertyWidget<NodeTypeIdPropertyWidgetComponent>;

/**
 * Obsidian's frontmatter Properties UI (reading view + live preview) renders each
 * property via a widget looked up by `metadataTypeManager`. This is unofficial/
 * internal API (see `obsidian-typings`), so it degrades gracefully: if Obsidian
 * ever drops support, the widget type is simply unrecognized and the property
 * renders as its raw text value, same as before this widget existed.
 */
const createWidget = (
  plugin: DiscourseGraphPlugin,
): NodeTypeIdPropertyWidget => ({
  type: WIDGET_TYPE,
  icon: "shapes",
  name: () => "Discourse node type",
  validate: (value: unknown) => typeof value === "string",
  render: (containerEl: HTMLElement, data: unknown) => {
    const nodeTypeId = typeof data === "string" ? data : String(data ?? "");
    const nodeType = getNodeTypeById(plugin, nodeTypeId);

    const el = containerEl.createSpan({
      cls: "dg-node-type-id-value",
      text: nodeType?.name ?? nodeTypeId,
    });
    el.setAttr("title", nodeTypeId);
    el.tabIndex = 0;

    return {
      type: WIDGET_TYPE,
      focus: () => el.focus(),
    };
  },
});

export const registerNodeTypeIdPropertyWidget = (
  plugin: DiscourseGraphPlugin,
): void => {
  const metadataTypeManager = (plugin.app as AppWithUnofficialApis)
    .metadataTypeManager;

  if (metadataTypeManager)
    try {
      metadataTypeManager.registeredTypeWidgets[WIDGET_TYPE] =
        createWidget(plugin);
      metadataTypeManager
        .setType(NODE_TYPE_ID_PROPERTY_KEY, WIDGET_TYPE)
        .catch((error) => console.error(error));
    } catch (error) {
      console.error(error);
    }
};

export const unregisterNodeTypeIdPropertyWidget = (
  plugin: DiscourseGraphPlugin,
): void => {
  const metadataTypeManager = (plugin.app as AppWithUnofficialApis)
    .metadataTypeManager;

  if (metadataTypeManager)
    try {
      if (
        metadataTypeManager.getAssignedWidget(NODE_TYPE_ID_PROPERTY_KEY) ===
        WIDGET_TYPE
      ) {
        metadataTypeManager
          .unsetType(NODE_TYPE_ID_PROPERTY_KEY)
          .catch((error) => console.error(error));
      }
      delete metadataTypeManager.registeredTypeWidgets[WIDGET_TYPE];
    } catch (error) {
      console.error(error);
    }
};
