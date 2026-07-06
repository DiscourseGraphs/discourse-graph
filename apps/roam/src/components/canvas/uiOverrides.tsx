import React, { ReactElement } from "react";
import {
  TLArrowBinding,
  TLArrowShape,
  TLImageShape,
  TLShape,
  TLShapeId,
  TLTextShape,
  TLUiDialogProps,
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
  TldrawUiDropdownMenuItem,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiIcon,
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
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  TldrawUiDialogCloseButton,
  TldrawUiDialogBody,
  TldrawUiDialogFooter,
} from "tldraw";
import { IKeyCombo } from "@blueprintjs/core";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { OnloadArgs } from "roamjs-components/types";
import { DiscourseContextType } from "./Tldraw";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import {
  COLOR_ARRAY,
  DISCOURSE_NODE_SHAPE_TYPE,
  getDiscourseNodeTypeId,
  isDiscourseNodeShape,
  type DiscourseNodeShape,
} from "./DiscourseNodeUtil";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { AddReferencedNodeType } from "./DiscourseRelationShape/DiscourseRelationTool";
import {
  DiscourseRelationShape,
  getRelationColor,
} from "./DiscourseRelationShape/DiscourseRelationUtil";
import {
  getDirectionalRelationLabel,
  getValidRelationTypesBetween,
  persistRelationArrow,
} from "./overlays/relationCreation";
import { getAllRelations } from "./canvasUtils";
import { createOrUpdateArrowBinding } from "./DiscourseRelationShape/helpers";
import DiscourseGraphPanel from "./DiscourseToolPanel";
import type { CanvasNodeShortcuts } from "~/components/settings/utils/zodSchema";
import { CustomDefaultToolbar } from "./CustomDefaultToolbar";
import { renderModifyNodeDialog } from "~/components/ModifyNodeDialog";
import { CanvasSyncMode } from "./canvasSyncMode";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";
import posthog from "posthog-js";
import { render as renderShareDataDialog } from "~/components/Export";
import type { Result } from "roamjs-components/types/query-builder";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";

const SyncModeMenuSwitchItem = ({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}): ReactElement => {
  return (
    <TldrawUiDropdownMenuItem>
      <TldrawUiButton
        type="menu"
        title={label}
        disabled={disabled}
        onClick={onToggle}
      >
        <TldrawUiButtonLabel>{label}</TldrawUiButtonLabel>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <TldrawUiIcon icon={checked ? "toggle-on" : "toggle-off"} small />
        </span>
      </TldrawUiButton>
    </TldrawUiDropdownMenuItem>
  );
};

const ConfirmCloudSyncDialog = ({
  onCancel,
  onConfirm,
}: TLUiDialogProps & {
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement => {
  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>Move canvas to cloud sync</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody>
        <p>Your current canvas will be migrated to the shared cloud backend.</p>
        <p>
          This will enable{" "}
          <span className="font-bold">real-time collaboration</span> between
          multiple users.
        </p>
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter className="tlui-dialog__footer__actions">
        <TldrawUiButton
          type="normal"
          onClick={() => {
            onCancel();
          }}
        >
          <TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
        </TldrawUiButton>
        <TldrawUiButton
          type="primary"
          onClick={() => {
            onConfirm();
            posthog.capture("Canvas: Toggle cloud sync");
          }}
        >
          <TldrawUiButtonLabel>Move to cloud sync</TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>
    </>
  );
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
      disableNodeTypeChange: true,
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
            type: DISCOURSE_NODE_SHAPE_TYPE,
            id: createShapeId(),
            props: {
              uid,
              title: text,
              h,
              w,
              imageUrl: nodeImageUrl,
              fontFamily: "sans",
              size: "s",
              nodeTypeId: nodeType,
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

type ArrowBoundNodeInfo = {
  startId: TLShapeId;
  endId: TLShapeId;
  startBinding: TLArrowBinding;
  endBinding: TLArrowBinding;
};

const getArrowBoundNodeInfo = (
  editor: Editor,
  arrow: TLShape,
): ArrowBoundNodeInfo | null => {
  const bindings = editor.getBindingsFromShape<TLArrowBinding>(arrow, "arrow");
  const startBinding = bindings.find((b) => b.props.terminal === "start");
  const endBinding = bindings.find((b) => b.props.terminal === "end");
  if (!startBinding || !endBinding) return null;
  if (startBinding.toId === endBinding.toId) return null;

  const startShape = editor.getShape(startBinding.toId);
  const endShape = editor.getShape(endBinding.toId);
  if (!startShape || !endShape) return null;
  if (!isDiscourseNodeShape(startShape) || !isDiscourseNodeShape(endShape))
    return null;

  return {
    startId: startBinding.toId,
    endId: endBinding.toId,
    startBinding,
    endBinding,
  };
};

const copyArrowBindingProps = (
  binding: TLArrowBinding,
): TLArrowBinding["props"] => ({
  ...binding.props,
  normalizedAnchor: { ...binding.props.normalizedAnchor },
});

const convertArrowToRelation = async ({
  editor,
  arrow,
  relationId,
}: {
  editor: Editor;
  arrow: TLArrowShape;
  relationId: string;
}): Promise<TLShapeId | null> => {
  const boundNodes = getArrowBoundNodeInfo(editor, arrow);
  if (!boundNodes) return null;

  const selectedRelation = getAllRelations().find((r) => r.id === relationId);
  if (!selectedRelation) return null;

  const sourceNode = editor.getShape(boundNodes.startId);
  const targetNode = editor.getShape(boundNodes.endId);
  if (!sourceNode || !targetNode) return null;

  const label = getDirectionalRelationLabel({
    relation: selectedRelation,
    sourceNodeType: getDiscourseNodeTypeId({ shape: sourceNode }),
    targetNodeType: getDiscourseNodeTypeId({ shape: targetNode }),
  });
  const relationColor = getRelationColor(selectedRelation.label);
  const relationArrowId = createShapeId();

  editor.createShape<DiscourseRelationShape>({
    id: relationArrowId,
    type: relationId,
    parentId: arrow.parentId,
    x: arrow.x,
    y: arrow.y,
    rotation: arrow.rotation,
    opacity: arrow.opacity,
    isLocked: arrow.isLocked,
    meta: { ...arrow.meta },
    props: {
      bend: arrow.props.bend,
      start: structuredClone(arrow.props.start),
      end: structuredClone(arrow.props.end),
      labelPosition: arrow.props.labelPosition,
      dash: "draw",
      size: "m",
      fill: "none",
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      font: "draw",
      scale: 1,
      color: relationColor,
      labelColor: relationColor,
      text: label,
    },
  });

  const relationArrow =
    editor.getShape<DiscourseRelationShape>(relationArrowId);
  if (!relationArrow) return null;

  createOrUpdateArrowBinding(
    editor,
    relationArrow,
    boundNodes.startId,
    copyArrowBindingProps(boundNodes.startBinding),
  );
  createOrUpdateArrowBinding(
    editor,
    relationArrow,
    boundNodes.endId,
    copyArrowBindingProps(boundNodes.endBinding),
  );

  await persistRelationArrow({
    editor,
    arrow: relationArrow,
    targetId: boundNodes.endId,
  });

  const persistedArrow =
    editor.getShape<DiscourseRelationShape>(relationArrowId);
  if (!persistedArrow) {
    editor.select(arrow.id);
    return null;
  }

  editor.deleteShapes([arrow.id]);
  editor.updateShapes([
    { id: persistedArrow.id, type: persistedArrow.type, index: arrow.index },
  ]);
  editor.select(relationArrowId);

  return relationArrowId;
};

type ShareableCanvasResult = Result & { type: string };

const isCanvasDiscourseNodeShape = (
  shape: TLShape,
): shape is DiscourseNodeShape => isDiscourseNodeShape(shape);

const getCanvasNodeText = (shape: DiscourseNodeShape): string =>
  getPageTitleByPageUid(shape.props.uid) ||
  getTextByBlockUid(shape.props.uid) ||
  shape.props.title;

export const getShareableCanvasSelectionResults = ({
  shapes,
}: {
  shapes: TLShape[];
}): ShareableCanvasResult[] => {
  const seenUids = new Set<string>();

  return shapes.reduce<ShareableCanvasResult[]>((results, shape) => {
    if (!isCanvasDiscourseNodeShape(shape)) return results;

    const { uid } = shape.props;
    if (!uid || !isLiveBlock(uid) || seenUids.has(uid)) return results;

    const text = getCanvasNodeText(shape);
    if (!text) return results;

    seenUids.add(uid);
    results.push({ text, uid, type: getDiscourseNodeTypeId({ shape }) });
    return results;
  }, []);
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
  const selectedShapes = useValue(
    "selectedShapes",
    () => editor.getSelectedShapes(),
    [editor],
  );
  const shareableResults = getShareableCanvasSelectionResults({
    shapes: selectedShapes,
  });
  const isTextSelected = selectedShape?.type === "text";
  const isImageSelected = selectedShape?.type === "image";
  const arrowRelationOptions = useValue(
    "arrowRelationOptions",
    () => {
      if (!selectedShape || selectedShape.type !== "arrow") return null;
      const boundNodes = getArrowBoundNodeInfo(editor, selectedShape);
      if (!boundNodes) return null;
      const relationTypes = getValidRelationTypesBetween({
        editor,
        startId: boundNodes.startId,
        endId: boundNodes.endId,
      });
      if (relationTypes.length === 0) return null;
      return { arrowId: selectedShape.id, ...boundNodes, relationTypes };
    },
    [editor, selectedShape],
  );

  return (
    <DefaultContextMenu>
      <DefaultContextMenuContent />
      {shareableResults.length > 0 && (
        <TldrawUiMenuGroup id="share-data-group">
          <TldrawUiMenuItem
            id="share-data"
            label="Share Data"
            readonlyOk
            onSelect={() => {
              const currentSelectedShapes = editor.getSelectedShapes();
              const currentResults = getShareableCanvasSelectionResults({
                shapes: currentSelectedShapes,
              });
              if (!currentResults.length) return;

              posthog.capture("Canvas: Share Data Clicked", {
                resultCount: currentResults.length,
                selectedShapeCount: currentSelectedShapes.length,
              });
              renderShareDataDialog({
                results: currentResults,
                isExportDiscourseGraph: true,
              });
            }}
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
      {arrowRelationOptions && (
        <TldrawUiMenuGroup id="relation-group">
          <TldrawUiMenuSubmenu id="relation-submenu" label="Relation">
            {arrowRelationOptions.relationTypes.map((rt) => (
              <TldrawUiMenuItem
                key={rt.id}
                id={`relation-${rt.id}`}
                label={rt.label}
                onSelect={async () => {
                  const arrow = editor.getShape<TLArrowShape>(
                    arrowRelationOptions.arrowId,
                  );
                  if (!arrow || arrow.type !== "arrow") return;

                  await convertArrowToRelation({
                    editor,
                    arrow,
                    relationId: rt.id,
                  });
                }}
              />
            ))}
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
  canvasSyncMode,
}: {
  allNodes: DiscourseNode[];
  allRelationNames: string[];
  allAddReferencedNodeActions: string[];
  canvasSyncMode: CanvasSyncMode;
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
      const actions = useActions();
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
          <TldrawUiMenuGroup id="sync-mode">
            <SyncModeMenuSwitchItem
              label="(Beta) Use cloud canvas"
              checked={canvasSyncMode === "sync"}
              disabled={canvasSyncMode === "sync"}
              onToggle={() => {
                void actions["toggle-cloud-sync"].onSelect("menu");
              }}
            />
          </TldrawUiMenuGroup>
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
  canvasSyncMode,
  onCanvasSyncModeChange,
  toggleMaximized,
  setConvertToDialogOpen,
}: {
  allNodes: DiscourseNode[];
  allRelationNames: string[];
  allAddReferencedNodeByAction: AddReferencedNodeType;
  discourseContext: DiscourseContextType;
  canvasSyncMode: CanvasSyncMode;
  onCanvasSyncModeChange: (mode: CanvasSyncMode) => void;
  toggleMaximized: () => void;
  setConvertToDialogOpen: (open: boolean) => void;
}): TLUiOverrides => ({
  tools: (editor, tools) => {
    // Get the custom keyboard shortcut for the discourse tool
    const discourseToolCombo = getPersonalSetting<IKeyCombo>([
      PERSONAL_KEYS.discourseToolShortcut,
    ]) || {
      key: "",
      modifiers: 0,
    };

    // For discourse tool, just use the key directly since we don't allow modifiers
    const discourseToolShortcut = discourseToolCombo?.key?.toUpperCase() || "";

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
    const canvasNodeShortcuts =
      getPersonalSetting<CanvasNodeShortcuts>([
        PERSONAL_KEYS.canvasNodeShortcuts,
      ]) ?? {};

    allNodes.forEach((node, index) => {
      const nodeId = node.type;
      const override = canvasNodeShortcuts[nodeId];
      tools[nodeId] = {
        id: nodeId,
        icon: "color",
        label: `shape.node.${node.type}` as TLUiTranslationKey,
        kbd: override?.enabled ? override.value : node.shortcut,
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
  actions: (_editor, actions, helpers) => {
    const { addToast, addDialog } = helpers;
    actions["convert-to"] = {
      id: "convert-to",
      label: "action.convert-to" as TLUiTranslationKey,
      kbd: "?C",
      onSelect: () => setConvertToDialogOpen(true),
      readonlyOk: true,
    };
    actions["toggle-cloud-sync"] = {
      id: "toggle-cloud-sync",
      label: "action.toggle-cloud-sync" as TLUiTranslationKey,
      kbd: "",
      onSelect: () => {
        if (canvasSyncMode === "sync") return;

        addDialog({
          component: ({ onClose }) => (
            <ConfirmCloudSyncDialog
              onClose={onClose}
              onCancel={onClose}
              onConfirm={() => {
                onCanvasSyncModeChange("sync");
                onClose();
              }}
            />
          ),
        });
      },
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
      "action.toggle-cloud-sync": "Toggle cloud canvas sync",
      "action.toggle-full-screen": "Toggle Full Screen",
      "tool.discourse-tool": "Discourse Graph",
    },
  },
});
