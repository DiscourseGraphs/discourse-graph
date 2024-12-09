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
import { COLOR_ARRAY, discourseContext } from "./Tldraw";
import { formatHexColor } from "../settings/DiscourseNodeCanvasSettings";
import { openCanvasDrawer } from "./CanvasDrawer";
import { OnloadArgs } from "roamjs-components/types";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import createDiscourseNode from "~/utils/createDiscourseNode";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import renderToast from "roamjs-components/components/Toast";
import { AddReferencedNodeType } from "./DiscourseRelationsUtil";

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
