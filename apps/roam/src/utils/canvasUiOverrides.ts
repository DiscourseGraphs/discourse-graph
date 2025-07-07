import {
  App as TldrawApp,
  MenuGroup,
  MenuItem,
  TLImageShape,
  TLShape,
  TLTextShape,
  TLTranslationKey,
  TldrawUiOverrides,
  createShapeId,
  toolbarItem,
  menuItem,
  SubMenu,
} from "@tldraw/tldraw";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { COLOR_ARRAY, discourseContext } from "~/components/canvas/Tldraw";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { openCanvasDrawer } from "~/components/canvas/CanvasDrawer";
import { OnloadArgs, InputTextNode } from "roamjs-components/types";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import createDiscourseNode from "~/utils/createDiscourseNode";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import renderToast from "roamjs-components/components/Toast";
import { AddReferencedNodeType } from "~/components/canvas/DiscourseRelationsUtil";
import nanoid from "nanoid";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import triplesToBlocks from "~/utils/triplesToBlocks";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createBlock from "roamjs-components/writes/createBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import createPage from "roamjs-components/writes/createPage";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { isPageUid } from "~/utils/isPageUid";

type TldrawAppRef = React.MutableRefObject<TldrawApp | undefined>;
type CreateUiOverridesProps = {
  allNodes: DiscourseNode[];
  allRelationNames: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
  extensionAPI: OnloadArgs["extensionAPI"];
  appRef: TldrawAppRef;
  maximized: boolean;
  setMaximized: React.Dispatch<React.SetStateAction<boolean>>;
};

export const createUiOverrides = ({
  allNodes,
  allRelationNames,
  allAddReferencedNodeByAction,
  extensionAPI,
  appRef,
  maximized,
  setMaximized,
}: CreateUiOverridesProps): TldrawUiOverrides => {
  const triggerContextMenuConvertTo = () => {
    const shape = appRef.current?.onlySelectedShape;
    if (!shape) return;
    const shapeEl = document.getElementById(shape.id);
    const rect = shapeEl?.getBoundingClientRect();
    const contextMenu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: rect?.left,
      clientY: rect?.top,
    });
    shapeEl?.dispatchEvent(contextMenu);
    const menuItem = document.querySelector(
      'button[data-wd="menu-item.convert-to"]',
    ) as HTMLMenuElement;
    if (menuItem) {
      setTimeout(() => {
        menuItem.click();
      }, 100);
    }
  };
  const addFullScreenToggle = (mainMenu: MenuGroup) => {
    const viewSubMenu = mainMenu.children.find(
      (m): m is SubMenu => m.type === "submenu" && m.id === "view",
    );
    const viewActionsGroup = viewSubMenu?.children.find(
      (m): m is MenuGroup => m.type === "group" && m.id === "view-actions",
    );
    if (!viewActionsGroup) return;
    viewActionsGroup.children.push({
      type: "item",
      readonlyOk: true,
      id: "toggle-full-screen",
      disabled: false,
      checked: maximized,
      actionItem: {
        id: "toggle-full-screen",
        label: "action.toggle-full-screen" as TLTranslationKey,
        kbd: "!3",
        onSelect: () => {
          setMaximized(!maximized);
        },
        readonlyOk: true,
      },
    });
  };
  const editCopyAsShortcuts = (mainMenu: MenuGroup) => {
    const editSubMenu = mainMenu.children.find(
      (m): m is SubMenu => m.type === "submenu" && m.id === "edit",
    );
    const conversionsGroup = editSubMenu?.children.find(
      (m): m is MenuGroup => m.type === "group" && m.id === "conversions",
    );
    const copyAsSubMenu = conversionsGroup?.children.find(
      (m): m is SubMenu => m.type === "submenu" && m.id === "copy-as",
    );
    const copyAsGroup = copyAsSubMenu?.children.find(
      (m): m is MenuGroup => m.type === "group" && m.id === "copy-as-group",
    );
    const copyAsPngItem = copyAsGroup?.children.find(
      (m): m is MenuItem => m.type === "item" && m.id === "copy-as-png",
    );
    const copyAsSvgItem = copyAsGroup?.children.find(
      (m): m is MenuItem => m.type === "item" && m.id === "copy-as-svg",
    );
    if (!copyAsPngItem || !copyAsSvgItem) return;
    copyAsPngItem.actionItem.kbd = "$!C";
    copyAsSvgItem.actionItem.kbd = "$!X";
  };

  return {
    tools(app, tools) {
      allNodes.forEach((node, index) => {
        tools[node.type] = {
          id: node.type,
          icon: "color",
          label: `shape.node.${node.type}` as TLTranslationKey,
          kbd: node.shortcut,
          readonlyOk: true,
          onSelect: () => {
            app.setSelectedTool(node.type);
          },
          style: {
            color:
              formatHexColor(node.canvasSettings.color) ||
              `var(--palette-${COLOR_ARRAY[index]})`,
          },
        };
      });
      allRelationNames.forEach((relation, index) => {
        tools[relation] = {
          id: relation,
          icon: "tool-arrow",
          label: `shape.relation.${relation}` as TLTranslationKey,
          kbd: "",
          readonlyOk: true,
          onSelect: () => {
            app.setSelectedTool(relation);
          },
          style: {
            color: `var(--palette-${COLOR_ARRAY[index + 1]})`,
          },
        };
      });
      Object.keys(allAddReferencedNodeByAction).forEach((name) => {
        const action = allAddReferencedNodeByAction[name];
        const nodeColorArray = Object.keys(discourseContext.nodes).map(
          (key) => ({
            text: discourseContext.nodes[key].text,
            color: discourseContext.nodes[key].canvasSettings.color,
          }),
        );
        const color =
          nodeColorArray.find((n) => n.text === action[0].sourceName)?.color ||
          "";
        tools[name] = {
          id: name,
          icon: "tool-arrow",
          label: `shape.referenced.${name}` as TLTranslationKey,
          kbd: "",
          readonlyOk: true,
          onSelect: () => {
            app.setSelectedTool(`${name}`);
          },
          style: {
            color: formatHexColor(color) ?? `var(--palette-${COLOR_ARRAY[0]})`,
          },
        };
      });
      return tools;
    },
    toolbar(_app, toolbar, { tools }) {
      toolbar.push(
        ...allNodes.map((n) => toolbarItem(tools[n.type])),
        ...allRelationNames.map((name) => toolbarItem(tools[name])),
        ...Object.keys(allAddReferencedNodeByAction).map((action) =>
          toolbarItem(tools[action]),
        ),
      );
      return toolbar;
    },
    contextMenu(app, schema, helpers) {
      // Dev Tools (only in development mode)
      if (process.env.NODE_ENV === "development") {
        const devToolsGroup: MenuGroup = {
          id: "dev-tools-group",
          type: "group",
          checkbox: false,
          disabled: false,
          readonlyOk: true,
          children: [
            {
              checked: false,
              disabled: false,
              readonlyOk: true,
              id: "dev-debug-info",
              type: "item",
              actionItem: {
                id: "dev-debug-info",
                label: "action.dev-debug-info" as TLTranslationKey,
                onSelect: () => {
                  console.log("Tldraw App State:", app);
                  console.log("Selected Shapes:", app.selectedIds);
                  console.log(
                    "All Shapes:",
                    app.store
                      .allRecords()
                      .filter((r) => r.typeName === "shape"),
                  );
                  renderToast({
                    id: "dev-debug-info",
                    intent: "success",
                    content: "Debug info logged to console",
                    timeout: 2000,
                  });
                },
                readonlyOk: true,
              },
            },
            {
              checked: false,
              disabled: false,
              readonlyOk: true,
              id: "dev-clear-canvas",
              type: "item",
              actionItem: {
                id: "dev-clear-canvas",
                label: "action.dev-clear-canvas" as TLTranslationKey,
                onSelect: () => {
                  const allShapes = app.store
                    .allRecords()
                    .filter((r) => r.typeName === "shape");
                  app.deleteShapes(allShapes.map((shape) => shape.id));
                  renderToast({
                    id: "dev-clear-canvas",
                    intent: "warning",
                    content: "Canvas cleared",
                    timeout: 2000,
                  });
                },
                readonlyOk: true,
              },
            },
            {
              checked: false,
              disabled: false,
              readonlyOk: true,
              id: "dev-create-all-nodes",
              type: "item",
              actionItem: {
                id: "dev-create-all-nodes",
                label: "action.dev-create-all-nodes" as TLTranslationKey,
                onSelect: async () => {
                  if (!extensionAPI) {
                    renderToast({
                      id: "dev-create-all-nodes-error",
                      intent: "danger",
                      content: "Extension API not available",
                      timeout: 3000,
                    });
                    return;
                  }

                  const discourseNodes = getDiscourseNodes().filter(
                    (node) => node.backedBy === "user",
                  );
                  const { x, y } = app.pageCenter;
                  const { w, h } = app.pageBounds;
                  const spacing = 300;
                  const nodesPerRow = Math.floor(w / spacing);

                  try {
                    for (let i = 0; i < discourseNodes.length; i++) {
                      const node = discourseNodes[i];
                      const nodeLabel = node.text;
                      const nodeName = `${nodeLabel}-${nanoid(4)}`;

                      // Create the node in Roam
                      const uid = await createDiscourseNode({
                        configPageUid: node.type,
                        text: nodeName,
                        extensionAPI,
                      });

                      // Calculate position for the shape
                      const row = Math.floor(i / nodesPerRow);
                      const col = i % nodesPerRow;
                      const shapeX = x - w / 2 + col * spacing + spacing / 2;
                      const shapeY = y - h / 2 + row * spacing + spacing / 2;

                      // Calculate size and image for the shape
                      const {
                        h: shapeH,
                        w: shapeW,
                        imageUrl,
                      } = await calcCanvasNodeSizeAndImg({
                        nodeText: nodeName,
                        extensionAPI,
                        nodeType: node.type,
                        uid,
                      });

                      // Create the shape on the canvas
                      app.createShapes([
                        {
                          type: node.type,
                          id: createShapeId(),
                          props: {
                            uid,
                            title: nodeName,
                            h: shapeH,
                            w: shapeW,
                            imageUrl,
                          },
                          x: shapeX,
                          y: shapeY,
                        },
                      ]);

                      // Small delay to prevent overwhelming the system
                      await new Promise((resolve) => setTimeout(resolve, 100));
                    }

                    renderToast({
                      id: "dev-create-all-nodes-success",
                      intent: "success",
                      content: `Created ${discourseNodes.length} nodes`,
                      timeout: 3000,
                    });
                  } catch (error) {
                    console.error("Error creating nodes:", error);
                    renderToast({
                      id: "dev-create-all-nodes-error",
                      intent: "danger",
                      content:
                        "Error creating nodes. Check console for details.",
                      timeout: 5000,
                    });
                  }
                },
                readonlyOk: true,
              },
            },
            {
              checked: false,
              disabled: false,
              readonlyOk: true,
              id: "dev-create-relation-labels",
              type: "item",
              actionItem: {
                id: "dev-create-relation-labels",
                label: "action.dev-create-relation-labels" as TLTranslationKey,
                onSelect: async () => {
                  const discourseRelations = getDiscourseRelations();
                  const { x, y } = app.pageCenter;
                  const { w, h } = app.pageBounds;
                  const groupSpacingX = 400;
                  const groupSpacingY = 250;
                  const labelsPerRow = 5;
                  const seenCombos = new Set();
                  const uniqueRelations = [];
                  for (let i = 0; i < discourseRelations.length; i++) {
                    const relation = discourseRelations[i];
                    const comboKey = `${relation.label}::${relation.source}::${relation.destination}`;
                    if (seenCombos.has(comboKey)) continue;
                    seenCombos.add(comboKey);
                    uniqueRelations.push(relation);
                  }

                  try {
                    for (let i = 0; i < uniqueRelations.length; i++) {
                      const relation = uniqueRelations[i];
                      const row = Math.floor(i / labelsPerRow);
                      const col = i % labelsPerRow;
                      const shapeX =
                        x - w / 2 + col * groupSpacingX + groupSpacingX / 2;
                      const shapeY =
                        y - h / 2 + row * groupSpacingY + groupSpacingY / 2;

                      const labelOffset = 30;
                      const sourceYOffset = 200;

                      const groupBaseX = shapeX + groupSpacingX;
                      const groupBaseY =
                        shapeY -
                        h / 2 +
                        row * groupSpacingY +
                        groupSpacingY / 2;

                      // Create source node in Roam
                      const sourceNodeName = `${relation.source}-${nanoid(4)}`;
                      const sourceUid = await createDiscourseNode({
                        configPageUid: relation.source,
                        text: sourceNodeName,
                        extensionAPI,
                      });

                      // Calculate size and image for the source shape
                      const {
                        h: sourceH,
                        w: sourceW,
                        imageUrl: sourceImageUrl,
                      } = await calcCanvasNodeSizeAndImg({
                        nodeText: sourceNodeName,
                        extensionAPI,
                        nodeType: relation.source,
                        uid: sourceUid,
                      });

                      // Create destination node in Roam
                      const destNodeName = `${relation.destination}-${nanoid(4)}`;
                      const destUid = await createDiscourseNode({
                        configPageUid: relation.destination,
                        text: destNodeName,
                        extensionAPI,
                      });

                      // Calculate size and image for the destination shape
                      const {
                        h: destH,
                        w: destW,
                        imageUrl: destImageUrl,
                      } = await calcCanvasNodeSizeAndImg({
                        nodeText: destNodeName,
                        extensionAPI,
                        nodeType: relation.destination,
                        uid: destUid,
                      });

                      // Create the relation in Roam using triplesToBlocks
                      const { triples, label: relationLabel } = relation;

                      // Create triples for this specific relation instance
                      const newTriples = triples
                        .map((t) => {
                          if (/is a/i.test(t[1])) {
                            const targetNode =
                              t[2] === "source" ? sourceNodeName : destNodeName;
                            const targetUid =
                              t[2] === "source" ? sourceUid : destUid;
                            return [
                              t[0],
                              isPageUid(targetUid) ? "has title" : "with uid",
                              isPageUid(targetUid)
                                ? getPageTitleByPageUid(targetUid)
                                : targetUid,
                            ];
                          }
                          return t.slice(0);
                        })
                        .map(([source, relation, target]) => ({
                          source,
                          relation,
                          target,
                        }));

                      // Create blocks in Roam
                      await triplesToBlocks({
                        defaultPageTitle: `Auto generated relation: ${relationLabel}`,
                        toPage: async (
                          title: string,
                          blocks: InputTextNode[],
                        ) => {
                          const parentUid =
                            getPageUidByPageTitle(title) ||
                            (await createPage({
                              title: title,
                            }));

                          await Promise.all(
                            blocks.map((node, order) =>
                              createBlock({ node, order, parentUid }).catch(
                                () =>
                                  console.error(
                                    `Failed to create block: ${JSON.stringify(
                                      { node, order, parentUid },
                                      null,
                                      4,
                                    )}`,
                                  ),
                              ),
                            ),
                          );
                          await openBlockInSidebar(parentUid);
                        },
                        nodeSpecificationsByLabel: Object.fromEntries(
                          Object.values(discourseContext.nodes).map((n) => [
                            n.text,
                            n.specification,
                          ]),
                        ),
                      })(newTriples)();

                      // Create shapes on the canvas
                      const sourceShapeId = createShapeId();
                      const destShapeId = createShapeId();
                      const arrowShapeId = createShapeId();

                      app.createShapes([
                        // Relation label (top)
                        {
                          type: "text",
                          id: createShapeId(),
                          props: {
                            text: relation.label,
                            color: "black",
                            size: "m",
                            font: "sans",
                            align: "start",
                          },
                          x: groupBaseX,
                          y: groupBaseY,
                        },
                        // Source node (below label)
                        {
                          type: relation.source,
                          id: sourceShapeId,
                          props: {
                            uid: sourceUid,
                            title: sourceNodeName,
                            h: sourceH,
                            w: sourceW,
                            imageUrl: sourceImageUrl,
                          },
                          x: groupBaseX,
                          y: groupBaseY + labelOffset,
                        },
                        // Destination node (below source)
                        {
                          type: relation.destination,
                          id: destShapeId,
                          props: {
                            uid: destUid,
                            title: destNodeName,
                            h: destH,
                            w: destW,
                            imageUrl: destImageUrl,
                          },
                          x: groupBaseX,
                          y: groupBaseY + labelOffset + sourceYOffset,
                        },
                        // Arrow connecting source to destination
                        {
                          type: relation.id,
                          id: arrowShapeId,
                          props: {
                            start: {
                              type: "binding",
                              boundShapeId: sourceShapeId,
                              normalizedAnchor: { x: 0.5, y: 1 },
                              isExact: false,
                            },
                            end: {
                              type: "binding",
                              boundShapeId: destShapeId,
                              normalizedAnchor: { x: 0.5, y: 0 },
                              isExact: false,
                            },
                            text: relationLabel,
                          },
                          x: 0,
                          y: 0,
                        },
                      ]);

                      // Small delay to prevent overwhelming the system
                      await new Promise((resolve) => setTimeout(resolve, 25));
                    }

                    renderToast({
                      id: "dev-create-relation-labels-success",
                      intent: "success",
                      content: `Created ${uniqueRelations.length} relations with blocks in Roam`,
                      timeout: 3000,
                    });
                  } catch (error) {
                    console.error("Error creating relation labels:", error);
                    renderToast({
                      id: "dev-create-relation-labels-error",
                      intent: "danger",
                      content:
                        "Error creating relations. Check console for details.",
                      timeout: 5000,
                    });
                  }
                },
                readonlyOk: true,
              },
            },
          ],
        };
        schema.push(devToolsGroup);
      }

      // Open Canvas Drawer
      if (!app.selectedIds.length) {
        const openCanvasDrawerGroup: MenuGroup = {
          id: "open-canvas-drawer-group",
          type: "group",
          checkbox: false,
          disabled: false,
          readonlyOk: true,
          children: [
            {
              checked: false,
              disabled: false,
              readonlyOk: true,
              id: "open-canvas-drawer",
              type: "item",
              actionItem: {
                id: "open-canvas-drawer",
                label: "action.open-canvas-drawer" as TLTranslationKey,
                onSelect: openCanvasDrawer,
                readonlyOk: true,
              },
            },
          ],
        };
        schema.push(openCanvasDrawerGroup);
      }

      // Convert To
      // convert image/text to Discourse Node
      if (helpers.oneSelected) {
        const shape = app.getShapeById(app.selectedIds[0]);
        if (!shape) return schema;
        const convertToDiscourseNode = async (
          text: string,
          type: string,
          imageShapeUrl?: string,
        ) => {
          if (!extensionAPI) {
            renderToast({
              id: "tldraw-warning",
              intent: "danger",
              content: `Failed to convert to ${type}.  Please contact support`,
            });
            return;
          }
          const nodeText =
            type === "blck-node"
              ? text
              : await getNewDiscourseNodeText({
                  text,
                  nodeType: type,
                });
          const uid = await createDiscourseNode({
            configPageUid: type,
            text: nodeText,
            imageUrl: imageShapeUrl,
            extensionAPI,
          });
          app.deleteShapes([shape.id]);
          const { x, y } = shape;
          const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
            nodeText: nodeText,
            extensionAPI,
            nodeType: type,
            uid,
          });
          app.createShapes([
            {
              type,
              id: createShapeId(),
              props: {
                uid,
                title: nodeText,
                h,
                w,
                imageUrl,
              },
              x,
              y,
            },
          ]);
        };
        const getOnSelectForShape = (shape: TLShape, nodeType: string) => {
          if (!shape.type) return null;
          if (shape.type === "image") {
            return async () => {
              const { assetId } = (shape as TLImageShape).props;
              if (!assetId) return;
              const asset = app.getAssetById(assetId);
              if (!asset || !asset.props.src) return;
              const file = await fetch(asset.props.src)
                .then((r) => r.arrayBuffer())
                .then((buf) => new File([buf], shape.id));
              const src = await window.roamAlphaAPI.util.uploadFile({
                file,
              });
              const text = nodeType === "blck-node" ? `![](${src})` : "";
              convertToDiscourseNode(text, nodeType, src);
            };
          } else if (shape.type === "text") {
            return () => {
              const { text } = (shape as TLTextShape).props;
              convertToDiscourseNode(text, nodeType);
            };
          }
        };

        if (shape.type === "image" || shape.type === "text") {
          const nodeMenuItems = allNodes.map((node) => {
            return {
              checked: false,
              id: `convert-to-${node.type}`,
              type: "item",
              readonlyOk: true,
              disabled: false,
              actionItem: {
                label: `action.convert-to-${node.type}` as TLTranslationKey,
                id: `convert-to-${node.type}`,
                onSelect: getOnSelectForShape(shape, node.type),
                readonlyOk: true,
                menuLabel: `Convert to ${node.text}` as TLTranslationKey,
                title: `Convert to ${node.text}`,
              },
            } as MenuItem;
          });

          // Page not yet supported
          // requires page-node to have image flag option
          const filteredItems =
            shape.type === "image"
              ? nodeMenuItems.filter(
                  (item) => item.id !== "convert-to-page-node",
                )
              : nodeMenuItems;

          const submenuGroup: MenuGroup = {
            id: "convert-to-group",
            type: "group",
            checkbox: false,
            disabled: false,
            readonlyOk: true,
            children: [
              {
                id: "convert-to",
                type: "submenu",
                label: "action.convert-to" as TLTranslationKey,
                disabled: false,
                readonlyOk: true,
                children: [...filteredItems],
              },
            ],
          };

          schema.push(submenuGroup);
        }
      }
      return schema;
    },
    actions(_app, actions) {
      (actions["toggle-full-screen"] = {
        id: "toggle-full-screen",
        label: "action.toggle-full-screen" as TLTranslationKey,
        kbd: "!3",
        onSelect: () => {
          setMaximized(!maximized);
        },
        readonlyOk: true,
      }),
        (actions["convert-to"] = {
          id: "convert-to",
          label: "action.convert-to" as TLTranslationKey,
          kbd: "?C",
          onSelect: () => triggerContextMenuConvertTo(),
          readonlyOk: true,
        });
      return actions;
    },
    keyboardShortcutsMenu(_app, keyboardShortcutsMenu, { tools, actions }) {
      const toolsGroup = keyboardShortcutsMenu.find(
        (group) => group.id === "shortcuts-dialog.tools",
      ) as MenuGroup;
      const viewGroup = keyboardShortcutsMenu.find(
        (group) => group.id === "shortcuts-dialog.view",
      ) as MenuGroup;
      const transformGroup = keyboardShortcutsMenu.find(
        (group) => group.id === "shortcuts-dialog.transform",
      ) as MenuGroup;

      toolsGroup.children.push(...allNodes.map((n) => menuItem(tools[n.type])));
      viewGroup.children.push(menuItem(actions["toggle-full-screen"]));
      transformGroup.children.push(menuItem(actions["convert-to"]));

      return keyboardShortcutsMenu;
    },
    menu(_app, menu) {
      const mainMenu = menu.find(
        (m): m is MenuGroup => m.type === "group" && m.id === "menu",
      );
      if (mainMenu) {
        addFullScreenToggle(mainMenu);
        editCopyAsShortcuts(mainMenu);
      }
      return menu;
    },
    translations: {
      en: {
        ...Object.fromEntries(
          allNodes.map((node) => [`shape.node.${node.type}`, node.text]),
        ),
        ...Object.fromEntries(
          allRelationNames.map((name) => [`shape.relation.${name}`, name]),
        ),
        ...Object.fromEntries(
          Object.keys(allAddReferencedNodeByAction).map((name) => [
            `shape.referenced.${name}`,
            name,
          ]),
        ),
        "action.toggle-full-screen": "Toggle Full Screen",
        "action.convert-to": "Convert to",
        "action.open-canvas-drawer": "Open Canvas Drawer",
        "action.dev-debug-info": "Debug Info",
        "action.dev-clear-canvas": "Clear Canvas",
        "action.dev-create-all-nodes": "Create All Node Types",
        "action.dev-create-relation-labels": "Create Relations with Blocks",
        ...Object.fromEntries(
          allNodes.map((node) => [
            `action.convert-to-${node.type}`,
            `${node.text}`,
          ]),
        ),
      },
    },
  };
};
