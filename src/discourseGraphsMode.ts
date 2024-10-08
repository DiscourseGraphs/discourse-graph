import {
  createConfigObserver,
  render as configPageRender,
} from "roamjs-components/components/ConfigPage";
import {
  CustomField,
  Field,
  FieldPanel,
  FlagField,
  SelectField,
  TextField,
} from "roamjs-components/components/ConfigPanels/types";
import DiscourseNodeConfigPanel from "./components/DiscourseNodeConfigPanel";
import DiscourseRelationConfigPanel from "./components/DiscourseRelationConfigPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import DEFAULT_RELATION_VALUES from "./data/defaultDiscourseRelations";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes from "./utils/getDiscourseNodes";
import refreshConfigTree from "./utils/refreshConfigTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import { render } from "./components/DiscourseNodeMenu";
import { render as discourseOverlayRender } from "./components/DiscourseContextOverlay";
import { render as previewRender } from "./components/LivePreview";
import { render as renderReferenceContext } from "./components/ReferenceContext";
import DiscourseContext, {
  DiscourseContextBackendConfig,
} from "./components/DiscourseContext";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import isDiscourseNode from "./utils/isDiscourseNode";
import isFlagEnabled from "./utils/isFlagEnabled";
import addStyle from "roamjs-components/dom/addStyle";
import { render as exportRender } from "./components/Export";
import { registerSelection } from "./utils/predefinedSelections";
import deriveNodeAttribute from "./utils/deriveDiscourseNodeAttribute";
import matchDiscourseNode from "./utils/matchDiscourseNode";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import React from "react";
import DiscourseNodeIndex from "./components/DiscourseNodeIndex";
import DiscourseNodeSpecification from "./components/DiscourseNodeSpecification";
import DiscourseNodeAttributes from "./components/DiscourseNodeAttributes";
import getSubTree from "roamjs-components/util/getSubTree";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import createPage from "roamjs-components/writes/createPage";
import INITIAL_NODE_VALUES from "./data/defaultDiscourseNodes";
import DiscourseNodeCanvasSettings from "./components/DiscourseNodeCanvasSettings";
import CanvasReferences from "./components/Tldraw/CanvasReferences";
import fireQuery from "./utils/fireQuery";
import { render as renderGraphOverviewExport } from "./components/ExportDiscourseContext";
import { Condition, QBClause } from "./utils/types";
import { DiscourseExportResult } from "./utils/getExportTypes";
import styles from "./styles/discourseGraphStyles.css";

export const SETTING = "discourse-graphs";

// TODO POST MIGRATE - move this logic within the toggle
const pageRefObservers = new Set<(s: HTMLSpanElement) => void>();
const pageRefObserverRef: { current?: MutationObserver } = {
  current: undefined,
};
const enablePageRefObserver = () =>
  (pageRefObserverRef.current = createHTMLObserver({
    useBody: true,
    tag: "SPAN",
    className: "rm-page-ref",
    callback: (s: HTMLSpanElement) => {
      pageRefObservers.forEach((f) => f(s));
    },
  }));
const disablePageRefObserver = () => {
  pageRefObserverRef.current?.disconnect();
  pageRefObserverRef.current = undefined;
};
const onPageRefObserverChange =
  (handler: (s: HTMLSpanElement) => void) => (b: boolean) => {
    if (b) {
      if (!pageRefObservers.size) enablePageRefObserver();
      pageRefObservers.add(handler);
    } else {
      pageRefObservers.delete(handler);
      if (!pageRefObservers.size) disablePageRefObserver();
    }
  };

const previewPageRefHandler = (s: HTMLSpanElement) => {
  const tag =
    s.getAttribute("data-tag") ||
    s.parentElement?.getAttribute("data-link-title");
  if (tag && !s.getAttribute("data-roamjs-discourse-augment-tag")) {
    s.setAttribute("data-roamjs-discourse-augment-tag", "true");
    const parent = document.createElement("span");
    previewRender({
      parent,
      tag,
      registerMouseEvents: ({ open, close }) => {
        s.addEventListener("mouseenter", (e) => open(e.ctrlKey));
        s.addEventListener("mouseleave", close);
      },
    });
    s.appendChild(parent);
  }
};

let enabled = false;

export const renderDiscourseNodeTypeConfigPage = ({
  title,
  h,
  onloadArgs,
}: {
  title: string;
  h: HTMLHeadingElement;
  onloadArgs: OnloadArgs;
}) => {
  if (!enabled) return;
  const nodeText = title.substring("discourse-graph/nodes/".length);
  const allNodes = getDiscourseNodes();
  const node = allNodes.find(({ text }) => text === nodeText);
  if (node) {
    const renderNode = () =>
      configPageRender({
        h,
        title,
        config: [
          // @ts-ignore
          {
            title: "Index",
            description: "Index of all of the pages in your graph of this type",
            Panel: CustomPanel,
            options: {
              component: ({ uid }) =>
                React.createElement(DiscourseNodeIndex, {
                  node,
                  parentUid: uid,
                  onloadArgs,
                }),
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Format",
            description: `DEPRACATED - Use specification instead. The format ${nodeText} pages should have.`,
            defaultValue: "\\",
            Panel: TextPanel,
            options: {
              placeholder: `Include "{content}" in format`,
            },
          } as Field<TextField>,
          // @ts-ignore
          {
            title: "Specification",
            description: `The conditions specified to identify a ${nodeText} node.`,
            Panel: CustomPanel,
            options: {
              component: ({ uid }) =>
                React.createElement(DiscourseNodeSpecification, {
                  node,
                  parentUid: uid,
                }),
            },
          } as Field<CustomField>,
          {
            title: "Shortcut",
            description: `The trigger to quickly create a ${nodeText} page from the node menu.`,
            defaultValue: "\\",
            // @ts-ignore
            Panel: TextPanel,
          },
          {
            title: "Description",
            description: `Describing what the ${nodeText} node represents in your graph.`,
            // @ts-ignore
            Panel: TextPanel,
          },
          {
            title: "Template",
            description: `The template that auto fills ${nodeText} page when generated.`,
            // @ts-ignore
            Panel: BlocksPanel,
          },
          // @ts-ignore
          {
            title: "Attributes",
            description: `A set of derived properties about the node based on queryable data.`,
            Panel: CustomPanel,
            options: {
              component: DiscourseNodeAttributes,
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Overlay",
            description: `Select which attribute is used for the Discourse Overlay`,
            Panel: SelectPanel,
            options: {
              items: () =>
                getSubTree({
                  parentUid: getPageUidByPageTitle(title),
                  key: "Attributes",
                }).children.map((c) => c.text),
            },
          } as Field<SelectField>,
          // @ts-ignore
          {
            title: "Canvas",
            description: `Various options for this node in the Discourse Canvas`,
            Panel: CustomPanel,
            options: {
              component: DiscourseNodeCanvasSettings,
            },
          } as Field<CustomField>,
          // @ts-ignore
          {
            title: "Graph Overview",
            Panel: FlagPanel,
            description: `Whether to color the node in the graph overview based on canvas color`,
            defaultValue: true,
          } as FieldPanel<FlagField>,
        ],
      });

    renderNode();
  }
};

export const getPlainTitleFromSpecification = ({
  specification,
  text,
}: {
  specification: Condition[];
  text: string;
}) => {
  // Assumptions:
  // - Conditions are properly ordered
  // - There is a 'has title' condition somewhere
  const titleCondition = specification.find(
    (s): s is QBClause =>
      s.type === "clause" && s.relation === "has title" && s.source === text
  );
  if (!titleCondition) return "";
  return titleCondition.target
    .replace(/^\/(\^)?/, "")
    .replace(/(\$)?\/$/, "")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\(\.[\*\+](\?)?\)/g, "");
};

const initializeDiscourseGraphsMode = async (args: OnloadArgs) => {
  const unloads = new Set<() => void>();
  window.roamjs.version = {
    ...window.roamjs.version,
    ["discourse-graph"]: args.extension.version,
  };
  unloads.add(function removeVersion() {
    delete window.roamjs.version.discourseGraph;
    unloads.delete(removeVersion);
  });

  const style = addStyle(styles);
  unloads.add(function removeStyle() {
    style.remove();
    unloads.delete(removeStyle);
  });

  const overlayPageRefHandler = (s: HTMLSpanElement) => {
    if (s.parentElement && !s.parentElement.closest(".rm-page-ref")) {
      const tag =
        s.getAttribute("data-tag") ||
        s.parentElement.getAttribute("data-link-title");
      if (
        tag &&
        !s.getAttribute("data-roamjs-discourse-overlay") &&
        isDiscourseNode(getPageUidByPageTitle(tag))
      ) {
        s.setAttribute("data-roamjs-discourse-overlay", "true");
        const parent = document.createElement("span");
        discourseOverlayRender({
          parent,
          tag: tag.replace(/\\"/g, '"'),
          onloadArgs: args,
        });
        if (s.hasAttribute("data-tag")) {
          s.appendChild(parent);
        } else {
          s.parentElement.appendChild(parent);
        }
      }
    }
  };

  const { pageUid, observer } = await createConfigObserver({
    title: "roam/js/discourse-graph",
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              title: "trigger",
              description:
                "The trigger to create the node menu. Must refresh after editing",
              defaultValue: "\\",
              // @ts-ignore
              Panel: TextPanel,
            },
            // @ts-ignore
            {
              title: "disable sidebar open",
              description:
                "Disable opening new nodes in the sidebar when created",
              Panel: FlagPanel,
            } as Field<FlagField>,
            // @ts-ignore
            {
              title: "preview",
              description:
                "Whether or not to display page previews when hovering over page refs",
              Panel: FlagPanel,
              options: {
                onChange: onPageRefObserverChange(previewPageRefHandler),
              },
            } as Field<FlagField>,
            // @ts-ignore
            ...(window.samepage
              ? [
                  {
                    title: "Use Backend",
                    description:
                      "Select individual features to query via SamePage backend.  Note: These settings are per user, not per graph.",
                    Panel: CustomPanel,
                    options: {
                      component: () =>
                        React.createElement(DiscourseContextBackendConfig, {
                          args,
                        }),
                    },
                  } as Field<CustomField>,
                ]
              : []),
          ],
        },
        {
          id: "grammar",
          fields: [
            // @ts-ignore
            {
              title: "nodes",
              Panel: CustomPanel,
              description: "The types of nodes in your discourse graph",
              options: {
                component: DiscourseNodeConfigPanel,
              },
            } as Field<CustomField>,
            // @ts-ignore
            {
              title: "relations",
              Panel: CustomPanel,
              description: "The types of relations in your discourse graph",
              defaultValue: DEFAULT_RELATION_VALUES,
              options: {
                component: DiscourseRelationConfigPanel,
              },
            } as Field<CustomField>,
            // @ts-ignore
            {
              title: "overlay",
              Panel: FlagPanel,
              description:
                "Whether to overlay discourse context information over node references",
              options: {
                onChange: (val) => {
                  onPageRefObserverChange(overlayPageRefHandler)(val);
                },
              },
            } as Field<FlagField>,
          ],
        },
        {
          id: "export",
          fields: [
            {
              title: "max filename length",
              // @ts-ignore
              Panel: NumberPanel,
              description:
                "Set the maximum name length for markdown file exports",
              defaultValue: 64,
            },
            {
              title: "remove special characters",
              // @ts-ignore
              Panel: FlagPanel,
              description:
                "Whether or not to remove the special characters in a file name",
            },
            {
              title: "simplified filename",
              // @ts-ignore
              Panel: FlagPanel,
              description:
                "For discourse nodes, extract out the {content} from the page name to become the file name",
            },
            {
              title: "frontmatter",
              // @ts-ignore
              Panel: MultiTextPanel,
              description:
                "Specify all the lines that should go to the Frontmatter of the markdown file",
            },
            {
              title: "resolve block references",
              // @ts-ignore
              Panel: FlagPanel,
              description:
                "Replaces block references in the markdown content with the block's content",
            },
            {
              title: "resolve block embeds",
              // @ts-ignore
              Panel: FlagPanel,
              description:
                "Replaces block embeds in the markdown content with the block's content tree",
            },
            // @ts-ignore
            {
              title: "link type",
              Panel: SelectPanel,
              description: "How to format links that appear in your export.",
              options: {
                items: ["alias", "wikilinks", "roam url"],
              },
            } as Field<SelectField>,
            {
              title: "append referenced node",
              // @ts-ignore
              Panel: FlagPanel,
              description:
                "If a referenced node is defined in a node's format, it will be appended to the discourse context",
            },
          ],
        },
      ],
    },
  });
  unloads.add(function configObserverDisconnect() {
    observer?.disconnect();
    unloads.delete(configObserverDisconnect);
  });

  refreshConfigTree();
  const nodes = getDiscourseNodes().filter((n) => n.backedBy !== "default");
  if (nodes.length === 0) {
    await Promise.all(
      INITIAL_NODE_VALUES.map(
        (n) =>
          getPageUidByPageTitle(`discourse-graph/nodes/${n.text}`) ||
          createPage({
            title: `discourse-graph/nodes/${n.text}`,
            uid: n.type,
            tree: [
              { text: "Format", children: [{ text: n.format }] },
              { text: "Shortcut", children: [{ text: n.shortcut }] },
            ],
          })
      )
    );
  }

  const hashChangeListener = (e: HashChangeEvent) => {
    if (
      e.oldURL.endsWith(pageUid) ||
      getDiscourseNodes().some(({ type }) => e.oldURL.endsWith(type))
    ) {
      refreshConfigTree();
    }
  };
  window.addEventListener("hashchange", hashChangeListener);
  unloads.add(function removeHashChangeListener() {
    window.removeEventListener("hashchange", hashChangeListener);
    unloads.delete(removeHashChangeListener);
  });

  const unregisterDatalog = refreshConfigTree().concat([
    registerSelection({
      test: /^(.*)-(.*)$/,
      pull: ({ returnNode }) => `(pull ?${returnNode} [:node/title])`,
      mapper: () => {
        return `This selection is deprecated. Define a Node Attribute and use \`discourse:attribute\` instead.`;
      },
    }),
    registerSelection({
      test: /^discourse:(.*)$/,
      pull: ({ returnNode }) => `(pull ?${returnNode} [:block/uid])`,
      mapper: (r, key) => {
        const attribute = key.substring("discourse:".length);
        const uid = r[":block/uid"] || "";
        return deriveNodeAttribute({ uid, attribute });
      },
    }),
    registerSelection({
      test: /^\s*type\s*$/i,
      pull: ({ returnNode }) =>
        `(pull ?${returnNode} [:node/title :block/string])`,
      mapper: (r) => {
        const title = r[":node/title"] || "";
        return (
          getDiscourseNodes().find((n) =>
            matchDiscourseNode({
              ...n,
              title,
            })
          )?.text || (r[":block/string"] ? "block" : "page")
        );
      },
    }),
  ]);
  unloads.add(function unregisterAllDatalog() {
    unregisterDatalog.forEach((u) => u());
    unloads.delete(unregisterAllDatalog);
  });
  const configTree = getBasicTreeByParentUid(pageUid);

  const trigger = getSettingValueFromTree({
    tree: configTree,
    key: "trigger",
    defaultValue: "\\",
  }).trim();
  const keydownListener = (e: KeyboardEvent) => {
    if (e.key === trigger) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "TEXTAREA" &&
        target.classList.contains("rm-block-input")
      ) {
        render({ textarea: target as HTMLTextAreaElement });
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };
  document.addEventListener("keydown", keydownListener);
  unloads.add(function removeKeydownListener() {
    document.removeEventListener("keydown", keydownListener);
    unloads.delete(removeKeydownListener);
  });

  const discourseContextObserver = createHTMLObserver({
    tag: "DIV",
    useBody: true,
    className: "rm-reference-main",
    callback: async (d: HTMLElement) => {
      const isMain = !!d.closest(".roam-article");
      const uid = isMain
        ? await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid()
        : getPageUidByPageTitle(getPageTitleValueByHtmlElement(d));
      if (
        uid &&
        isDiscourseNode(uid) &&
        !d.getAttribute("data-roamjs-discourse-context")
      ) {
        d.setAttribute("data-roamjs-discourse-context", "true");
        const parent = d.firstElementChild;
        if (parent) {
          const insertBefore = parent.firstElementChild;

          const p = document.createElement("div");
          parent.insertBefore(p, insertBefore);
          renderWithUnmount(
            React.createElement(DiscourseContext, {
              uid,
              results: [],
              args,
            }),
            p,
            args
          );

          const canvasP = document.createElement("div");
          parent.insertBefore(canvasP, insertBefore);
          renderWithUnmount(
            React.createElement(CanvasReferences, {
              uid,
            }),
            canvasP,
            args
          );
        }
      }
    },
  });

  const graphOverviewExportObserver = createHTMLObserver({
    tag: "DIV",
    className: "rm-graph-view-control-panel__main-options",
    callback: (el) => {
      const div = el as HTMLDivElement;
      renderGraphOverviewExport(div);
    },
  });

  unloads.add(function removeObservers() {
    graphOverviewExportObserver.disconnect();
    discourseContextObserver.disconnect();

    unloads.delete(removeObservers);
  });

  if (isFlagEnabled("preview")) pageRefObservers.add(previewPageRefHandler);
  if (isFlagEnabled("grammar.overlay")) {
    pageRefObservers.add(overlayPageRefHandler);
  }
  if (pageRefObservers.size) enablePageRefObserver();

  const queryPages = args.extensionAPI.settings.get("query-pages");
  const queryPageArray = Array.isArray(queryPages)
    ? queryPages
    : typeof queryPages === "object"
    ? []
    : typeof queryPages === "string" && queryPages
    ? [queryPages]
    : [];
  if (!queryPageArray.includes("discourse-graph/queries/*")) {
    args.extensionAPI.settings.set("query-pages", [
      ...queryPageArray,
      "discourse-graph/queries/*",
    ]);
  }
  unloads.add(function removeQueryPage() {
    args.extensionAPI.settings.set(
      "query-pages",
      (
        (args.extensionAPI.settings.get("query-pages") as string[]) || []
      ).filter((s) => s !== "discourse-graph/queries/*")
    );
    unloads.delete(removeQueryPage);
  });

  type SigmaRenderer = {
    setSetting: (settingName: string, value: any) => void;
    getSetting: (settingName: string) => any;
  };
  type nodeData = {
    x: number;
    y: number;
    label: string;
    size: number;
  };

  window.roamAlphaAPI.ui.graphView.wholeGraph.addCallback({
    label: "discourse-node-styling",
    callback: ({ "sigma-renderer": sigma }) => {
      const sig = sigma as SigmaRenderer;
      const allNodes = getDiscourseNodes();
      const prefixColors = allNodes.map((n) => {
        const formattedTitle = getPlainTitleFromSpecification({
          specification: n.specification,
          text: n.text,
        });
        const formattedBackgroundColor =
          n.canvasSettings.color && !n.canvasSettings.color.startsWith("#")
            ? `#${n.canvasSettings.color}`
            : n.canvasSettings.color;

        return {
          prefix: formattedTitle,
          color: formattedBackgroundColor,
          showInGraphOverview: n.graphOverview,
        };
      });

      const originalReducer = sig.getSetting("nodeReducer");
      sig.setSetting("nodeReducer", (id: string, nodeData: nodeData) => {
        let modifiedData = originalReducer
          ? originalReducer(id, nodeData)
          : nodeData;

        const { label } = modifiedData;

        for (const { prefix, color, showInGraphOverview } of prefixColors) {
          if (showInGraphOverview && label.startsWith(prefix)) {
            return {
              ...modifiedData,
              color,
            };
          }
        }

        return modifiedData;
      });
    },
  });
  unloads.add(function removeGraphViewCallback() {
    window.roamAlphaAPI.ui.graphView.wholeGraph.removeCallback({
      label: "discourse-node-styling",
    });
    unloads.delete(removeGraphViewCallback);
  });

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Export Discourse Graph",
    callback: () => {
      const discourseNodes = getDiscourseNodes().filter(
        (r) => r.backedBy !== "default"
      );
      const results: (
        isSamePageEnabled: boolean
      ) => Promise<DiscourseExportResult[]> = (isSamePageEnabled: boolean) =>
        Promise.all(
          discourseNodes.map((d) =>
            fireQuery({
              returnNode: "node",
              conditions: [
                {
                  relation: "is a",
                  source: "node",
                  target: d.type,
                  uid: window.roamAlphaAPI.util.generateUID(),
                  type: "clause",
                },
              ],
              selections: [],
              isSamePageEnabled,
            }).then((queryResults) =>
              queryResults.map((result) => ({
                ...result,
                type: d.type,
              }))
            )
          )
        ).then((r) => r.flat());
      exportRender({
        results,
        title: "Export Discourse Graph",
        isExportDiscourseGraph: true,
        initialPanel: "export",
      });
    },
  });

  if (isFlagEnabled("render references")) {
    createHTMLObserver({
      className: "rm-sidebar-window",
      tag: "div",
      callback: (d) => {
        const label = d.querySelector<HTMLSpanElement>(
          ".window-headers div span"
        );
        if (label && label.innerText.startsWith("Outline")) {
          const titleEl =
            d.querySelector<HTMLHeadingElement>(".rm-title-display");
          const title = titleEl && getPageTitleValueByHtmlElement(titleEl);
          if (title && isDiscourseNode(getPageUidByPageTitle(title))) {
            const container = renderReferenceContext({ title });
            d.appendChild(container);
          }
        }
      },
    });
  }
  return () => {
    unloads.forEach((u) => u());
    unloads.clear();
  };
};

export default initializeDiscourseGraphsMode;
