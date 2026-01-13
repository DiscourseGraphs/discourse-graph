/* eslint-disable @typescript-eslint/naming-convention */
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
import type { OnloadArgs } from "roamjs-components/types";
import { DiscourseContextType } from "./Tldraw";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { COLOR_ARRAY } from "./DiscourseNodeUtil";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { AddReferencedNodeType } from "./DiscourseRelationShape/DiscourseRelationTool";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";
import DiscourseGraphPanel from "./DiscourseToolPanel";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { CustomDefaultToolbar } from "./CustomDefaultToolbar";
import { renderModifyNodeDialog } from "~/components/ModifyNodeDialog";

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
  const { x, y } = shape;

  const openDialogAndCreateShape = ({
    initialText,
    imageUrl,
  }: {
    initialText: string;
    imageUrl?: string;
  }) => {
    renderModifyNodeDialog({
      mode: "create",
      nodeType,
      initialValue: { text: initialText, uid: "" },
      extensionAPI,
      includeDefaultNodes: true,
      imageUrl,
      onSuccess: async ({ text, uid }) => {
        editor.deleteShapes([shape.id]);

        const {
          h,
          w,
          imageUrl: nodeImageUrl,
        } = await calcCanvasNodeSizeAndImg({
          nodeText: text,
          extensionAPI,
          nodeType,
          uid,
        });
        editor.createShapes([
          {
            type: nodeType,
            id: createShapeId(),
            props: {
              uid,
              title: text,
              h,
              w,
              imageUrl: nodeImageUrl,
              fontFamily: "sans",
              size: "s",
            },
            x,
            y,
          },
        ]);
      },
      onClose: () => {},
    });
  };

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
      const initialText = nodeType === "blck-node" ? `![](${src})` : "";

      openDialogAndCreateShape({ initialText, imageUrl: src });
    };
  } else if (shape.type === "text") {
    return () => {
      const { text } = (shape as TLTextShape).props;
      openDialogAndCreateShape({ initialText: text });
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
                    label={node.text}
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
    const discourseToolShortcut =
      getPersonalSetting<string>(["Discourse Tool Shortcut"])?.toUpperCase() ||
      "";

    tools["discourse-tool"] = {
      id: "discourse-tool",
      icon: "discourseNodeIcon",
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
      "action.toggle-full-screen": "Toggle Full Screen",
      "tool.discourse-tool": "Discourse Graph",
    },
  },
});
