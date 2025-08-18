import React from "react";
import {
  TLImageShape,
  TLShape,
  TLTextShape,
  TLUiOverrides,
  TLUiTranslationKey,
  createShapeId,
  Editor,
  useTools,
  useIsToolSelected,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  DefaultMainMenu,
  TldrawUiMenuGroup,
  useActions,
  DefaultContextMenu,
  DefaultContextMenuContent,
  TLUiComponents,
  EditSubmenu,
  ExportFileContentSubMenu,
  ExtrasGroup,
  PreferencesGroup,
  TldrawUiMenuSubmenu,
  ZoomTo100MenuItem,
  ZoomToFitMenuItem,
  ZoomToSelectionMenuItem,
  useEditor,
  useValue,
  useToasts,
} from "tldraw";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import createDiscourseNode from "~/utils/createDiscourseNode";
import type { OnloadArgs } from "roamjs-components/types";
import { DiscourseContextType } from "./Tldraw";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { COLOR_ARRAY } from "./DiscourseNodeUtil";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { openCanvasDrawer } from "./CanvasDrawer";
import { AddReferencedNodeType } from "./DiscourseRelationShape/DiscourseRelationTool";
import { dispatchToastEvent } from "./ToastListener";

const convertToDiscourseNode = async ({
  text,
  type,
  imageShapeUrl,
  extensionAPI,
  editor,
  selectedShape,
}: {
  text: string;
  type: string;
  imageShapeUrl?: string;
  extensionAPI: OnloadArgs["extensionAPI"];
  editor: Editor;
  selectedShape: TLShape | null;
}) => {
  if (!extensionAPI) {
    dispatchToastEvent({
      id: "tldraw-warning",
      title: `Failed to convert to ${type}.  Please contact support`,
      severity: "error",
    });
    return;
  }
  if (!selectedShape) {
    dispatchToastEvent({
      id: "tldraw-warning",
      title: `No shape selected.`,
      severity: "warning",
    });
    return;
  }
  const nodeText =
    type === "blck-node"
      ? text
      : await getNewDiscourseNodeText({ text, nodeType: type });
  const uid = await createDiscourseNode({
    configPageUid: type,
    text: nodeText,
    imageUrl: imageShapeUrl,
    extensionAPI,
  });
  editor.deleteShapes([selectedShape.id]);
  const { x, y } = selectedShape;
  const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
    nodeText: nodeText,
    extensionAPI,
    nodeType: type,
    uid,
  });
  editor.createShapes([
    {
      type,
      id: createShapeId(),
      props: { uid, title: nodeText, h, w, imageUrl },
      x,
      y,
    },
  ]);
};

export const getOnSelectForShape = ({
  shape,
  nodeType,
  editor,
  extensionAPI,
}: {
  shape: TLShape;
  nodeType: string;
  editor: Editor;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  if (shape.type === "image") {
    return async () => {
      const { assetId } = (shape as TLImageShape).props;
      if (!assetId) return;
      const asset = editor.getAsset(assetId);
      if (!asset || !asset.props.src) return;
      const file = await fetch(asset.props.src)
        .then((r) => r.arrayBuffer())
        .then((buf) => new File([buf], shape.id));
      // this is a promise
      // eslint-disable-next-line @typescript-eslint/await-thenable
      const src = await window.roamAlphaAPI.util.uploadFile({ file });
      const text = nodeType === "blck-node" ? `![](${src})` : "";
      void convertToDiscourseNode({
        text,
        type: nodeType,
        imageShapeUrl: src,
        editor,
        selectedShape: shape,
        extensionAPI,
      });
    };
  } else if (shape.type === "text") {
    return () => {
      const { text } = (shape as TLTextShape).props;
      void convertToDiscourseNode({
        text,
        type: nodeType,
        editor,
        selectedShape: shape,
        extensionAPI,
      });
    };
  }
  return () => {};
};

export const CustomContextMenu = ({
  extensionAPI,
  allNodes,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  allNodes: DiscourseNode[];
}) => {
  const editor = useEditor();
  const selectedShape = useValue(
    "selectedShape",
    () => editor.getOnlySelectedShape(),
    [editor],
  );
  const isTextSelected = selectedShape?.type === "text";
  const isImageSelected = selectedShape?.type === "image";

  return (
    <DefaultContextMenu>
      <DefaultContextMenuContent />
      {!selectedShape && (
        <TldrawUiMenuGroup id="open-canvas-drawer-group">
          <TldrawUiMenuItem
            id="open-canvas-drawer"
            label="Open Canvas Drawer"
            readonlyOk
            onSelect={openCanvasDrawer}
          />
        </TldrawUiMenuGroup>
      )}
      {(isTextSelected || isImageSelected) && (
        <TldrawUiMenuGroup id="convert-to-group">
          <TldrawUiMenuSubmenu id="convert-to-submenu" label="Convert To">
            {allNodes
              // Page not yet supported: requires page-node to have image flag option
              .filter((node) => !(isImageSelected && node.type === "page-node"))
              .map((node) => {
                return (
                  <TldrawUiMenuItem
                    key={node.type}
                    id={`convert-to-${node.type}`}
                    label={`Convert To ${node.text}`}
                    readonlyOk
                    onSelect={getOnSelectForShape({
                      shape: selectedShape,
                      nodeType: node.type,
                      editor,
                      extensionAPI,
                    })}
                  />
                );
              })}
          </TldrawUiMenuSubmenu>
        </TldrawUiMenuGroup>
      )}
    </DefaultContextMenu>
  );
};
export const createUiComponents = ({
  allNodes,
  allAddReferencedNodeActions,
  allRelationNames,
}: {
  allNodes: DiscourseNode[];
  allRelationNames: string[];
  allAddReferencedNodeActions: string[];
}): TLUiComponents => {
  return {
    Toolbar: (props) => {
      const tools = useTools();
      return (
        <DefaultToolbar {...props}>
          <DefaultToolbarContent />
          {allNodes.map((n) => (
            <TldrawUiMenuItem
              key={n.type}
              {...tools[n.type]}
              // eslint-disable-next-line react-hooks/rules-of-hooks
              isSelected={useIsToolSelected(tools[n.type])}
            />
          ))}
          {allRelationNames.map((name) => (
            <TldrawUiMenuItem
              key={name}
              {...tools[name]}
              // eslint-disable-next-line react-hooks/rules-of-hooks
              isSelected={useIsToolSelected(tools[name])}
            />
          ))}
          {allAddReferencedNodeActions.map((action) => (
            <TldrawUiMenuItem
              key={action}
              {...tools[action]}
              // eslint-disable-next-line react-hooks/rules-of-hooks
              isSelected={useIsToolSelected(tools[action])}
            />
          ))}
        </DefaultToolbar>
      );
    },
    KeyboardShortcutsDialog: (props) => {
      const tools = useTools();
      const actions = useActions();
      return (
        <DefaultKeyboardShortcutsDialog {...props}>
          {allNodes.map((n) => (
            <TldrawUiMenuItem key={n.type} {...tools[n.type]} />
          ))}
          {/* {allRelationNames.map((name) => (
            <TldrawUiMenuItem {...tools[name]} />
          ))}
          {allAddRefNodeActions.map((action) => (
            <TldrawUiMenuItem {...tools[action]} />
          ))}
          */}
          <TldrawUiMenuItem {...actions["toggle-full-screen"]} />
          <TldrawUiMenuItem {...actions["convert-to"]} />
          <DefaultKeyboardShortcutsDialogContent />
        </DefaultKeyboardShortcutsDialog>
      );
    },
    MainMenu: () => {
      const CustomViewMenu = () => {
        const actions = useActions();
        return (
          <TldrawUiMenuSubmenu id="view" label="menu.view">
            <TldrawUiMenuGroup id="view-actions">
              <TldrawUiMenuItem {...actions["zoom-in"]} />
              <TldrawUiMenuItem {...actions["zoom-out"]} />
              <ZoomTo100MenuItem />
              <ZoomToFitMenuItem />
              <ZoomToSelectionMenuItem />
              <TldrawUiMenuItem {...actions["toggle-full-screen"]} />
            </TldrawUiMenuGroup>
          </TldrawUiMenuSubmenu>
        );
      };

      return (
        <DefaultMainMenu>
          <EditSubmenu />
          <CustomViewMenu /> {/* Replaced <ViewSubmenu /> */}
          <ExportFileContentSubMenu />
          <ExtrasGroup />
          <PreferencesGroup />
        </DefaultMainMenu>
      );
    },
  };
};
export const createUiOverrides = ({
  allNodes,
  allRelationNames,
  allAddReferencedNodeByAction,
  discourseContext,
  maximized,
  setMaximized,
  setConvertToDialogOpen,
}: {
  allNodes: DiscourseNode[];
  allRelationNames: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
  discourseContext: DiscourseContextType;
  maximized: boolean;
  setMaximized: (maximized: boolean) => void;
  setConvertToDialogOpen: (open: boolean) => void;
}): TLUiOverrides => ({
  tools: (editor, tools) => {
    allNodes.forEach((node, index) => {
      const nodeId = node.type;
      tools[nodeId] = {
        id: nodeId,
        icon: "color",
        label: `shape.node.${node.type}` as TLUiTranslationKey,
        kbd: node.shortcut,
        onSelect: () => {
          editor.setCurrentTool(nodeId);
        },
        readonlyOk: true,
        style: {
          color:
            formatHexColor(node.canvasSettings.color) ||
            `${COLOR_ARRAY[index]}`,
        },
      };
    });

    allRelationNames.forEach((name, index) => {
      tools[name] = {
        id: name,
        icon: "tool-arrow",
        label: name as TLUiTranslationKey,
        kbd: "",
        readonlyOk: true,
        onSelect: () => {
          editor.setCurrentTool(name);
        },
        style: {
          // TODO: get color from canvasSettings
          color:
            name === "Supports" || name === "Supported By"
              ? "green"
              : name === "Opposes" || name === "Opposed By"
                ? "red"
                : `${COLOR_ARRAY[index + 1]}`,
        },
      };
    });
    Object.keys(allAddReferencedNodeByAction).forEach((name) => {
      const action = allAddReferencedNodeByAction[name];
      const nodeColorArray = Object.keys(discourseContext.nodes).map((key) => ({
        text: discourseContext.nodes[key].text,
        color: discourseContext.nodes[key].canvasSettings.color,
      }));
      const color =
        nodeColorArray.find((n) => n.text === action[0].sourceName)?.color ||
        "";
      tools[name] = {
        id: name,
        icon: "tool-arrow",
        label: name as TLUiTranslationKey,
        kbd: "",
        readonlyOk: true,
        onSelect: () => {
          editor.setCurrentTool(`${name}`);
        },
        style: {
          color: formatHexColor(color) ?? `var(--palette-${COLOR_ARRAY[0]})`,
        },
      };
    });

    return tools;
  },
  actions: (editor, actions) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { addToast } = useToasts();
    actions["convert-to"] = {
      id: "convert-to",
      label: "action.convert-to" as TLUiTranslationKey,
      kbd: "?C",
      onSelect: () => setConvertToDialogOpen(true),
      readonlyOk: true,
    };
    actions["toggle-full-screen"] = {
      id: "toggle-full-screen",
      label: "action.toggle-full-screen" as TLUiTranslationKey,
      kbd: "!3",
      onSelect: () => setMaximized(!maximized),
      readonlyOk: true,
    };

    const originalCopyAsSvgAction = actions["copy-as-svg"];
    const originalCopyAsPngAction = actions["copy-as-png"];

    actions["copy-as-svg"] = {
      ...originalCopyAsSvgAction,
      kbd: "$!X",
      onSelect: (source) => {
        void originalCopyAsSvgAction.onSelect(source);
        addToast({ title: "Copied as SVG" });
      },
    };
    actions["copy-as-png"] = {
      ...originalCopyAsPngAction,
      kbd: "$!C",
      onSelect: (source) => {
        void originalCopyAsPngAction.onSelect(source);
        addToast({ title: "Copied as PNG" });
      },
    };
    return actions;
  },
  translations: {
    en: {
      ...Object.fromEntries(
        allNodes.map((node) => [`shape.node.${node.type}`, node.text]),
      ),
      // "shape.myShape.myShape": "Relation",
      // ...Object.fromEntries(
      //   allRelationNames.map((name) => [`shape.relation.${name}`, name])
      // ),
      // ...Object.fromEntries(
      //   allAddRefNodeActions.map((name) => [`shape.referenced.${name}`, name])
      // ),
      "action.toggle-full-screen": "Toggle Full Screen",
      // "action.convert-to": "Convert to",
      // ...Object.fromEntries(
      //   allNodes.map((node) => [
      //     `action.convert-to-${node.type}`,
      //     `${node.text}`,
      //   ])
      // ),
      // TODO: copy as
    },
  },
});
