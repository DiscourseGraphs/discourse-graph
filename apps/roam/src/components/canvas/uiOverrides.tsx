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
import { IKeyCombo } from "@blueprintjs/core";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import createDiscourseNode from "~/utils/createDiscourseNode";
import type { OnloadArgs } from "roamjs-components/types";
import { DiscourseContextType } from "./Tldraw";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { COLOR_ARRAY } from "./DiscourseNodeUtil";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { AddReferencedNodeType } from "./DiscourseRelationShape/DiscourseRelationTool";
import { dispatchToastEvent } from "./ToastListener";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";
import DiscourseGraphPanel from "./DiscourseToolPanel";
import { convertComboToTldrawFormat } from "~/utils/keyboardShortcutUtils";
import { DISCOURSE_TOOL_SHORTCUT_KEY } from "~/data/userSettings";
import { getSetting } from "~/utils/extensionSettings";
import { ClipboardToolbarButton } from "./Clipboard";
import { CustomDefaultToolbar } from "./CustomDefaultToolbar";

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
      props: {
        uid,
        title: nodeText,
        h,
        w,
        imageUrl,
        fontFamily: "sans",
        size: "s",
      },
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
        <CustomDefaultToolbar {...props}>
          <TldrawUiMenuItem
            key="discourse-tool"
            {...tools["discourse-tool"]}
            isSelected={useIsToolSelected(tools["discourse-tool"])}
          />
          <DefaultToolbarContent />
        </CustomDefaultToolbar>
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
    SharePanel: () => {
      const allRelations = [
        ...allRelationNames,
        ...allAddReferencedNodeActions,
      ];
      return <DiscourseGraphPanel nodes={allNodes} relations={allRelations} />;
    },
  };
};
export const createUiOverrides = ({
  allNodes,
  allRelationNames,
  allAddReferencedNodeByAction,
  discourseContext,
  toggleMaximized,
  setConvertToDialogOpen,
}: {
  allNodes: DiscourseNode[];
  allRelationNames: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
  discourseContext: DiscourseContextType;
  toggleMaximized: () => void;
  setConvertToDialogOpen: (open: boolean) => void;
}): TLUiOverrides => ({
  tools: (editor, tools) => {
    // Get the custom keyboard shortcut for the discourse tool
    const discourseToolCombo = getSetting(DISCOURSE_TOOL_SHORTCUT_KEY, {
      key: "",
      modifiers: 0,
    }) as IKeyCombo;

    // For discourse tool, just use the key directly since we don't allow modifiers
    const discourseToolShortcut = discourseToolCombo?.key?.toUpperCase() || "";

    tools["discourse-tool"] = {
      id: "discourse-tool",
      icon: "none",
      label: "tool.discourse-tool" as TLUiTranslationKey,
      kbd: discourseToolShortcut,
      readonlyOk: true,
      onSelect: () => {
        editor.setCurrentTool("discourse-tool");
      },
    };
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
          color: getRelationColor(name, index),
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
      onSelect: () => toggleMaximized(),
      readonlyOk: true,
    };

    const originalCopyAsSvgAction = actions["copy-as-svg"];
    const originalCopyAsPngAction = actions["copy-as-png"];
    const originalPrintAction = actions["print"];

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
    // Disable print keyboard binding to prevent conflict with command palette
    if (originalPrintAction) {
      actions["print"] = {
        ...originalPrintAction,
        kbd: "", // Remove keyboard shortcut to prevent conflict
      };
    }
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
      "tool.discourse-tool": "Discourse Graph",
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
