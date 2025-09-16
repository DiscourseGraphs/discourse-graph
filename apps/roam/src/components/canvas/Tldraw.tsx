/* eslint-disable @typescript-eslint/naming-convention */
import React, { useState, useRef, useMemo, useEffect } from "react";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";

import {
  Editor as TldrawApp,
  TLEditorComponents,
  TLUiComponents,
  TldrawEditor,
  TldrawHandles,
  TldrawScribble,
  TldrawSelectionBackground,
  TldrawSelectionForeground,
  TldrawUi,
  defaultBindingUtils,
  defaultShapeTools,
  defaultShapeUtils,
  defaultTools,
  useEditor,
  VecModel,
  createShapeId,
  TLPointerEventInfo,
  TLExternalContent,
  MediaHelpers,
  AssetRecordType,
  TLAsset,
  TLAssetId,
  getHashForString,
  TLShapeId,
  TLShape,
  useToasts,
  useTranslation,
  DEFAULT_SUPPORTED_IMAGE_TYPES,
  DEFAULT_SUPPORT_VIDEO_TYPES,
  registerDefaultExternalContentHandlers,
  registerDefaultSideEffects,
  defaultEditorAssetUrls,
  usePreloadAssets,
  StateNode,
  DefaultSpinner,
  Box,
} from "tldraw";
import "tldraw/tldraw.css";
import tldrawStyles from "./tldrawStyles";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import {
  CustomContextMenu,
  createUiComponents,
  createUiOverrides,
} from "./uiOverrides";
import {
  BaseDiscourseNodeUtil,
  DiscourseNodeShape,
  createNodeShapeTools,
  createNodeShapeUtils,
} from "./DiscourseNodeUtil";
import { useRoamStore } from "./useRoamStore";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "~/utils/findDiscourseNode";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import renderToast from "roamjs-components/components/Toast";
import {
  createAllReferencedNodeUtils,
  createAllRelationShapeUtils,
} from "./DiscourseRelationShape/DiscourseRelationUtil";
import {
  AddReferencedNodeType,
  createAllReferencedNodeTools,
  createAllRelationShapeTools,
} from "./DiscourseRelationShape/DiscourseRelationTool";
import {
  createAllReferencedNodeBindings,
  createAllRelationBindings,
} from "./DiscourseRelationShape/DiscourseRelationBindings";
import ConvertToDialog from "./ConvertToDialog";
import { createMigrations } from "./DiscourseRelationShape/discourseRelationMigrations";
import ToastListener, { dispatchToastEvent } from "./ToastListener";
import sendErrorEmail from "~/utils/sendErrorEmail";
import { TLDRAW_DATA_ATTRIBUTE } from "./tldrawStyles";
import { AUTO_CANVAS_RELATIONS_KEY } from "~/data/userSettings";
import { getSetting } from "~/utils/extensionSettings";
import { isPluginTimerReady, waitForPluginTimer } from "~/utils/pluginTimer";
import { HistoryEntry } from "@tldraw/store";
import { TLRecord } from "@tldraw/tlschema";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

declare global {
  interface Window {
    tldrawApps: Record<string, TldrawApp>;
  }
}
export type DiscourseContextType = {
  // { [Node.id] => DiscourseNode }
  nodes: Record<string, DiscourseNode & { index: number }>;
  // { [Relation.Label] => DiscourseRelation[] }
  relations: Record<string, DiscourseRelation[]>;
  lastAppEvent: string;
  lastActions: HistoryEntry<TLRecord>[];
};

export const discourseContext: DiscourseContextType = {
  nodes: {},
  relations: {},
  lastAppEvent: "",
  lastActions: [],
};

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;
export const MAX_WIDTH = "400px";

export const isPageUid = (uid: string) =>
  !!window.roamAlphaAPI.pull("[:node/title]", [":block/uid", uid])?.[
    ":node/title"
  ];

const TldrawCanvas = ({ title }: { title: string }) => {
  const appRef = useRef<TldrawApp | null>(null);
  const lastInsertRef = useRef<VecModel>();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActionsRef = useRef<HistoryEntry<TLRecord>[]>(
    discourseContext.lastActions,
  );

  const [isConvertToDialogOpen, setConvertToDialogOpen] = useState(false);

  const updateViewportScreenBounds = (el: HTMLDivElement) => {
    // Use tldraw's built-in viewport bounds update with centering
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      appRef.current?.updateViewportScreenBounds(
        new Box(rect.left, rect.top, rect.width, rect.height),
        true,
      );
    });
  };
  const handleMaximizedChange = () => {
    // Direct DOM manipulation to avoid React re-renders
    if (!containerRef.current) return;
    const tldrawEl = containerRef.current;
    const wrapper = tldrawEl.closest(".roam-article, .rm-sidebar-outline");

    if (tldrawEl.classList.contains("relative")) {
      // Going to fullscreen
      if (wrapper) wrapper.classList.add("dg-tldraw-maximized");
      tldrawEl.classList.add("absolute", "inset-0");
      tldrawEl.classList.remove("relative");
      updateViewportScreenBounds(tldrawEl);
    } else {
      // Going back to normal
      if (wrapper) wrapper.classList.remove("dg-tldraw-maximized");
      tldrawEl.classList.add("relative");
      tldrawEl.classList.remove("absolute", "inset-0");
      updateViewportScreenBounds(tldrawEl);
    }
  };

  // Workaround to avoid a race condition when loading a canvas page directly
  // Start false to avoid noisy warnings on first render if timer isn't initialized yet
  const [isPluginReady, setIsPluginReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isPluginReady) {
      // If already ready, flip immediately
      if (isPluginTimerReady()) {
        setIsPluginReady(true);
        return;
      }

      // Otherwise, wait up to the timeout and proceed either way
      void (async () => {
        const ready = await waitForPluginTimer();
        if (cancelled) return;

        if (!ready) {
          console.warn(
            "Plugin timer timeout — proceeding with canvas mount anyway.",
          );
          // Optional: dispatchToastEvent({ id: 'tldraw-plugin-timer-timeout', title: 'Timed out waiting for plugin init', severity: 'warning' })
        }

        setIsPluginReady(true);
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [isPluginReady]);
  const allRelations = useMemo(() => {
    const relations = getDiscourseRelations();
    discourseContext.relations = relations.reduce(
      (acc, r) => {
        if (acc[r.label]) {
          acc[r.label].push(r);
        } else {
          acc[r.label] = [r];
        }
        return acc;
      },
      {} as Record<string, DiscourseRelation[]>,
    );
    return relations;
  }, []);
  const allRelationsById = useMemo(() => {
    return Object.fromEntries(allRelations.map((r) => [r.id, r])) as Record<
      string,
      DiscourseRelation
    >;
  }, [allRelations]);
  const allRelationIds = useMemo(() => {
    return Object.keys(allRelationsById);
  }, [allRelationsById]);
  const allRelationNames = useMemo(() => {
    return Object.keys(discourseContext.relations);
  }, []);
  const allNodes = useMemo(() => {
    const allNodes = getDiscourseNodes(allRelations);
    discourseContext.nodes = Object.fromEntries(
      allNodes.map((n, index) => [n.type, { ...n, index }]),
    );
    return allNodes;
  }, [allRelations]);

  const allAddReferencedNodeByAction = useMemo(() => {
    const obj: AddReferencedNodeType = {};

    // TODO: support multiple referenced node
    // with migration from format to specification
    allNodes.forEach((n) => {
      const referencedNodes = [...n.format.matchAll(/{([\w\d-]+)}/g)].filter(
        (match) => match[1] !== "content",
      );

      if (referencedNodes.length > 0) {
        const sourceName = referencedNodes[0][1];
        const sourceType = allNodes.find((node) => node.text === sourceName)
          ?.type as string;

        if (!obj[`Add ${sourceName}`]) obj[`Add ${sourceName}`] = [];

        obj[`Add ${sourceName}`].push({
          format: n.format,
          sourceName,
          sourceType,
          destinationType: n.type,
          destinationName: n.text,
        });
      }
    });

    return obj;
  }, [allNodes]);
  const allAddReferencedNodeActions = useMemo(() => {
    return Object.keys(allAddReferencedNodeByAction);
  }, [allAddReferencedNodeByAction]);

  const isRelationTool = (toolId: string) => {
    return (
      allRelationNames.includes(toolId) ||
      allAddReferencedNodeActions.includes(toolId)
    );
  };

  const isDiscourseNodeShape = (
    shape: TLShape,
  ): shape is DiscourseNodeShape => {
    return allNodes.some((node) => node.type === shape.type);
  };

  // Add state for tracking relation creation
  const relationCreationRef = useRef<{
    isCreating: boolean;
    relationShapeId?: TLShapeId;
    sourceShapeId?: TLShapeId;
    toolType?: string;
  }>({
    isCreating: false,
  });

  const handleRelationCreation = (app: TldrawApp, e: TLPointerEventInfo) => {
    // Handle relation creation on pointer_down
    if (e.type === "pointer" && e.name === "pointer_down") {
      const currentTool = app.getCurrentTool();
      const currentToolId = currentTool.id;
      const pagePoint = app.screenToPage(e.point);
      const shapeAtPoint = app.getShapeAtPoint(pagePoint);

      // Check if current tool is a relation tool
      if (isRelationTool(currentToolId)) {
        relationCreationRef.current.isCreating = true;
        relationCreationRef.current.toolType = currentToolId;

        // If we clicked on a discourse node, record it as the source
        if (shapeAtPoint && isDiscourseNodeShape(shapeAtPoint)) {
          relationCreationRef.current.sourceShapeId = shapeAtPoint.id;
        }
      }
    }

    // Handle relation creation on pointer_up
    if (e.type === "pointer" && e.name === "pointer_up") {
      const pagePoint = app.screenToPage(e.point);
      const shapeAtPoint = app.getShapeAtPoint(pagePoint);

      // Handle relation creation completion
      if (relationCreationRef.current.isCreating) {
        // Find the relation shape that was just created
        const selectedShapes = app.getSelectedShapes();
        const relationShape = selectedShapes.find(
          (shape) =>
            allRelationIds.includes(shape.type) ||
            allAddReferencedNodeActions.includes(shape.type),
        );

        if (relationShape) {
          relationCreationRef.current.relationShapeId = relationShape.id;

          // Check if we have a target shape
          if (shapeAtPoint && isDiscourseNodeShape(shapeAtPoint)) {
            // We have a valid target, call the relation creation method
            const util = app.getShapeUtil(relationShape);
            if (
              util &&
              typeof (util as any).handleCreateRelationsInRoam === "function"
            ) {
              (util as any).handleCreateRelationsInRoam({
                arrow: relationShape,
                targetId: shapeAtPoint.id,
              });
            }
          } else {
            // No target shape, delete the relation and show toast
            app.deleteShapes([relationShape.id]);
            dispatchToastEvent({
              id: "tldraw-relation-no-target",
              title: "Relation must connect to a node. Relation deleted.",
              severity: "warning",
            });
          }
        } else {
          console.log("No relation shape found in selection");
        }

        // Reset relation creation state
        relationCreationRef.current = {
          isCreating: false,
        };
      }
    }
  };

  const extensionAPI = useExtensionAPI();

  // COMPONENTS
  const defaultEditorComponents: TLEditorComponents = {
    Scribble: TldrawScribble,
    CollaboratorScribble: TldrawScribble,
    SelectionForeground: TldrawSelectionForeground,
    SelectionBackground: TldrawSelectionBackground,
    Handles: TldrawHandles,
  };
  const editorComponents: TLEditorComponents = {
    ...defaultEditorComponents,
    OnTheCanvas: ToastListener,
  };
  const customUiComponents: TLUiComponents = createUiComponents({
    allNodes,
    allRelationNames,
    allAddReferencedNodeActions,
  });

  // UTILS
  const discourseNodeUtils = createNodeShapeUtils(allNodes);
  const discourseRelationUtils = createAllRelationShapeUtils(allRelationIds);
  const referencedNodeUtils = createAllReferencedNodeUtils(
    allAddReferencedNodeByAction,
  );
  const customShapeUtils = [
    ...discourseNodeUtils,
    ...discourseRelationUtils,
    ...referencedNodeUtils,
  ];

  // TOOLS
  const discourseGraphTool = class DiscourseGraphTool extends StateNode {
    static override id = "discourse-tool";
    static override initial = "idle";
  };
  const discourseNodeTools = createNodeShapeTools(allNodes);
  const discourseRelationTools = createAllRelationShapeTools(allRelationNames);
  const referencedNodeTools = createAllReferencedNodeTools(
    allAddReferencedNodeByAction,
  );
  const customTools = [
    discourseGraphTool,
    ...discourseNodeTools,
    ...discourseRelationTools,
    ...referencedNodeTools,
  ];

  // BINDINGS
  const relationBindings = createAllRelationBindings(allRelationIds);
  const referencedNodeBindings = createAllReferencedNodeBindings(
    allAddReferencedNodeByAction,
  );
  const customBindingUtils = [...relationBindings, ...referencedNodeBindings];

  // UI OVERRIDES
  const uiOverrides = createUiOverrides({
    allNodes,
    allRelationNames,
    allAddReferencedNodeByAction,
    toggleMaximized: handleMaximizedChange,
    setConvertToDialogOpen,
    discourseContext,
  });

  // STORE
  const pageUid = useMemo(() => getPageUidByPageTitle(title), [title]);
  const arrowShapeMigrations = useMemo(
    () =>
      createMigrations({
        allRelationIds,
        allAddReferencedNodeActions,
        allNodeTypes: allNodes.map((node) => node.type),
      }),
    [allRelationIds, allAddReferencedNodeActions, allNodes],
  );

  const migrations = [arrowShapeMigrations];
  const { store, needsUpgrade, performUpgrade, error } = useRoamStore({
    migrations,
    customShapeUtils,
    customBindingUtils,
    pageUid,
  });

  // ASSETS
  const assetLoading = usePreloadAssets(defaultEditorAssetUrls);

  // Handle actions (roamjs:query-builder:action)
  useEffect(() => {
    const handleMoveCameraToShapeAction = ({
      shapeId,
    }: {
      shapeId: TLShapeId;
    }) => {
      const app = appRef.current;
      if (!app) return;
      const shape = app.getShape(shapeId);
      if (!shape) {
        return dispatchToastEvent({
          id: "tldraw-warning",
          title: `Shape not found.`,
          severity: "warning",
        });
      }
      const x = shape?.x || 0;
      const y = shape?.y || 0;
      app.centerOnPoint({ x, y }, { animation: { duration: 200 } });
      app.select(shapeId);
    };
    const actionListener = ((
      e: CustomEvent<{
        action: string;
        uid?: string;
        val?: string;
        shapeId?: TLShapeId;
        onRefresh: () => void;
      }>,
    ) => {
      if (e.detail.action === "move-camera-to-shape") {
        if (!e.detail.shapeId) return;
        handleMoveCameraToShapeAction({ shapeId: e.detail.shapeId });
      }
      if (!/canvas/i.test(e.detail.action)) return;
      const app = appRef.current;
      if (!app) return;
      const { x, y } = app.getViewportScreenCenter();
      const { w, h } = app.getViewportPageBounds();
      const lastTime = lastInsertRef.current;
      const position = lastTime
        ? { x: lastTime.x + w * 0.025, y: lastTime.y + h * 0.05 }
        : { x: x - DEFAULT_WIDTH / 2, y: y - DEFAULT_HEIGHT / 2 };
      const nodeType = findDiscourseNode(e.detail.uid, allNodes);
      if (nodeType) {
        app.createShapes([
          {
            type: nodeType.type,
            id: createShapeId(),
            props: {
              uid: e.detail.uid,
              title: e.detail.val,
              size: "s",
              fontFamily: "sans",
            },
            ...position,
          },
        ]);
        lastInsertRef.current = position;
        e.detail.onRefresh();
      }
    }) as EventListener;
    document.addEventListener("roamjs:query-builder:action", actionListener);
    return () => {
      document.removeEventListener(
        "roamjs:query-builder:action",
        actionListener,
      );
    };
  }, [appRef, allNodes]);

  // Catch a custom event we used patch-package to add
  useEffect(() => {
    const handleTldrawError = (
      e: CustomEvent<{ message: string; stack: string | null }>,
    ) => {
      const error = new Error(e.detail.message);
      if (e.detail.stack) {
        error.stack = e.detail.stack;
      }

      sendErrorEmail({
        error,
        type: "Tldraw Error",
        context: {
          title: title,
          user: getCurrentUserDisplayName(),
          lastActions: lastActionsRef.current,
        },
      }).catch(() => {});

      console.error("Tldraw Error:", e.detail);
    };

    document.addEventListener(
      "tldraw:error",
      handleTldrawError as EventListener,
    );

    return () => {
      document.removeEventListener(
        "tldraw:error",
        handleTldrawError as EventListener,
      );
    };
  }, []);

  return (
    <div
      className="roamjs-tldraw-canvas-container relative z-10 h-full w-full overflow-hidden rounded-md border border-gray-300 bg-white"
      ref={containerRef}
      tabIndex={-1}
    >
      <style>{tldrawStyles}</style>

      {needsUpgrade ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-semibold">Upgrade Required</h2>
            <p className="mb-4 text-gray-600">
              Your tldraw canvas is using an old format. Click below to upgrade.
            </p>
            <button
              className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
              onClick={() => {
                const handleUpgrade = async () => {
                  await performUpgrade();
                  renderToast({
                    id: "tldraw-upgrade",
                    intent: "success",
                    content: "Canvas upgraded.",
                  });
                };
                void handleUpgrade();
              }}
            >
              Upgrade Canvas
            </button>
          </div>
        </div>
      ) : !store || !assetLoading.done || !extensionAPI || !isPluginReady ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-semibold">
              {error || assetLoading.error
                ? "Error Loading Canvas"
                : "Loading Canvas"}
            </h2>
            <p className="mb-4 text-gray-600">
              {error || assetLoading.error ? (
                "There was a problem loading the Tldraw canvas. Please try again later."
              ) : (
                <DefaultSpinner />
              )}
            </p>
          </div>
        </div>
      ) : (
        <>
          <ConvertToDialog
            allNodes={allNodes}
            extensionAPI={extensionAPI}
            isOpen={isConvertToDialogOpen}
            onClose={() => setConvertToDialogOpen(false)}
            editor={appRef.current}
          />
          <TldrawEditor
            // baseUrl="https://samepage.network/assets/tldraw/"
            // instanceId={initialState.instanceId}
            initialState="select"
            shapeUtils={[...defaultShapeUtils, ...customShapeUtils]}
            tools={[...defaultTools, ...defaultShapeTools, ...customTools]}
            bindingUtils={[...defaultBindingUtils, ...customBindingUtils]}
            components={editorComponents}
            store={store}
            onMount={(app) => {
              if (process.env.NODE_ENV !== "production") {
                if (!window.tldrawApps) window.tldrawApps = {};
                const { tldrawApps } = window;
                tldrawApps[title] = app;
              }

              appRef.current = app;

              app.on("change", (entry) => {
                lastActionsRef.current.push(entry);
                if (lastActionsRef.current.length > 5)
                  lastActionsRef.current.shift();
              });

              app.on("event", (event) => {
                const e = event as TLPointerEventInfo;

                discourseContext.lastAppEvent = e.name;

                // Handle relation creation on pointer_down
                handleRelationCreation(app, e);

                // Open Node in main window or sidebar
                // TODO - this should move to one of DiscourseNodeTool's children classes instead

                // handle node clicked with modifiers
                // navigate / open in sidebar
                const validModifier = e.shiftKey || e.ctrlKey; // || e.metaKey;
                if (!(e.name === "pointer_up" && validModifier)) return;
                if (app.getSelectedShapes().length) return; // User is positioning selected shape
                const shape = app.getShapeAtPoint(
                  app.inputs.currentPagePoint,
                ) as DiscourseNodeShape;
                if (!shape) return;
                const shapeUid = shape.props.uid;

                if (!isLiveBlock(shapeUid)) {
                  if (!shape.props.title) return;
                  dispatchToastEvent({
                    id: "tldraw-warning",
                    title: `Not a valid UID. Cannot Open.`,
                    severity: "warning",
                  });
                }

                if (e.shiftKey) openBlockInSidebar(shapeUid);

                if (
                  e.ctrlKey
                  // || e.metaKey
                ) {
                  const isPage = !!getPageTitleByPageUid(shapeUid);
                  if (isPage) {
                    void window.roamAlphaAPI.ui.mainWindow.openPage({
                      page: { uid: shapeUid },
                    });
                  } else {
                    void window.roamAlphaAPI.ui.mainWindow.openBlock({
                      block: { uid: shapeUid },
                    });
                  }
                }
              });
            }}
          >
            <TldrawUi
              overrides={uiOverrides}
              components={customUiComponents}
              assetUrls={defaultEditorAssetUrls}
            >
              <InsideEditorAndUiContext
                extensionAPI={extensionAPI}
                allNodes={allNodes}
                allRelationIds={allRelationIds}
                allAddReferencedNodeActions={allAddReferencedNodeActions}
              />
            </TldrawUi>
          </TldrawEditor>
        </>
      )}
    </div>
  );
};

// apps\examples\src\examples\exploded\ExplodedExample.tsx
// We put these hooks into a component here so that they can run inside of the context provided by TldrawEditor and TldrawUi
const InsideEditorAndUiContext = ({
  extensionAPI,
  allNodes,
  allRelationIds,
  allAddReferencedNodeActions,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  allNodes: DiscourseNode[];
  allRelationIds: string[];
  allAddReferencedNodeActions: string[];
}) => {
  const editor = useEditor();
  const toasts = useToasts();
  const msg = useTranslation();

  // https://tldraw.dev/examples/data/assets/hosted-images
  const ACCEPTED_IMG_TYPE = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/svg+xml",
  ];
  const isImage = (ext: string) => ACCEPTED_IMG_TYPE.includes(ext);
  const isCustomArrowShape = (shape: TLShape) => {
    // TODO: find a better way to identify custom arrow shapes
    // possibly migrate to shape.type or shape.name
    // or add as meta
    const allRelationIdSet = new Set(allRelationIds);
    const allAddReferencedNodeActionsSet = new Set(allAddReferencedNodeActions);

    return (
      allRelationIdSet.has(shape.type) ||
      allAddReferencedNodeActionsSet.has(shape.type)
    );
  };

  useEffect(() => {
    registerDefaultExternalContentHandlers(
      editor,
      {
        maxImageDimension: 5000,
        maxAssetSize: 10 * 1024 * 1024, // 10mb
        acceptedImageMimeTypes: DEFAULT_SUPPORTED_IMAGE_TYPES,
        acceptedVideoMimeTypes: DEFAULT_SUPPORT_VIDEO_TYPES,
      },
      { toasts, msg },
    );
    editor.registerExternalContentHandler(
      "files",
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (content: TLExternalContent) => {
        if (content.type !== "files") {
          console.error("Expected files, received:", content.type);
          return;
        }
        const file = content.files[0];

        const url = await window.roamAlphaAPI.file.upload({ file });
        const dataUrl = url.replace(/^!\[\]\(/, "").replace(/\)$/, "");
        // TODO add video support
        const isImageType = isImage(file.type);
        if (!isImageType) {
          console.error("Unsupported file type:", file.type);
          return;
        }
        const size = await MediaHelpers.getImageSize(file);
        const isAnimated = await MediaHelpers.isAnimated(file);
        const assetId: TLAssetId = AssetRecordType.createId(
          getHashForString(dataUrl),
        );
        const shapeType = isImageType ? "image" : "video";
        const asset: TLAsset = AssetRecordType.create({
          id: assetId,
          type: shapeType,
          typeName: "asset",
          props: {
            name: file.name,
            src: dataUrl,
            w: size.w,
            h: size.h,
            fileSize: file.size,
            mimeType: file.type,
            isAnimated,
          },
        });
        editor.createAssets([asset]);
        editor.createShape({
          type: "image",
          // Center the image in the editor
          x: (window.innerWidth - size.w) / 2,
          y: (window.innerHeight - size.h) / 2,
          props: { assetId, w: size.w, h: size.h },
        });

        return asset;
      },
    );
    //https://github.com/tldraw/tldraw/blob/v2.3.x/packages/tldraw/src/lib/defaultExternalContentHandlers.ts#L183
    editor.registerExternalContentHandler(
      "svg-text",
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (content: TLExternalContent) => {
        if (content.type !== "svg-text") {
          console.error("Expected svg-text, received:", content.type);
          return;
        }

        const { text, point } = content;
        const svgString = text;

        const svg = new DOMParser()
          .parseFromString(svgString, "image/svg+xml")
          .querySelector("svg");
        if (!svg) {
          throw new Error("No <svg/> element present");
        }

        let width = parseFloat(svg.getAttribute("width") || "0");
        let height = parseFloat(svg.getAttribute("height") || "0");

        if (!(width && height)) {
          document.body.appendChild(svg);
          const box = svg.getBoundingClientRect();
          document.body.removeChild(svg);

          width = box.width;
          height = box.height;
        }

        const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
        const file = new File([svgBlob], "image.svg", {
          type: "image/svg+xml",
        });

        const url = await window.roamAlphaAPI.file.upload({ file });
        const dataUrl = url.replace(/^!\[\]\(/, "").replace(/\)$/, "");

        const assetId: TLAssetId = AssetRecordType.createId(
          getHashForString(dataUrl),
        );
        const asset: TLAsset = AssetRecordType.create({
          id: assetId,
          type: "image",
          typeName: "asset",
          props: {
            name: "image.svg",
            src: dataUrl,
            w: width,
            h: height,
            fileSize: file.size,
            mimeType: "image/svg+xml",
            isAnimated: false,
          },
        });

        editor.createAssets([asset]);

        const position =
          point ??
          (editor.inputs.shiftKey
            ? editor.inputs.currentPagePoint
            : editor.getViewportPageBounds().center);

        editor.createShape({
          type: "image",
          x: position.x - width / 2,
          y: position.y - height / 2,
          props: { assetId, w: width, h: height },
        });

        return asset;
      },
    );

    const registerCustomSideEffects = () => {
      const removeBeforeChangeHandler =
        editor.sideEffects.registerBeforeChangeHandler(
          "shape",
          (prevShape, nextShape) => {
            // TODO: Re-enable relation movement prevention with a different mechanism
            // This was disabled because it was firing when it shouldn't
            // The original logic prevented moving relations with bindings
            // if (isCustomArrowShape(prevShape)) {
            //   const bindings = editor.getBindingsFromShape(
            //     prevShape,
            //     prevShape.type,
            //   );
            //   const isTranslating = editor.isIn("select.translating");
            //   if (bindings.length && isTranslating) {
            //     editor.setSelectedShapes([]);
            //     toasts.addToast({
            //       id: "tldraw-toast-cannot-move-relation",
            //       title: "Cannot move relation.",
            //       severity: "warning",
            //     });
            //     return prevShape;
            //   }
            // }
            return nextShape;
          },
        );

      const removeAfterCreateHandler =
        editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
          const util = editor.getShapeUtil(shape);
          if (util instanceof BaseDiscourseNodeUtil) {
            const autoCanvasRelations = getSetting<boolean>(
              AUTO_CANVAS_RELATIONS_KEY,
              false,
            );
            if (autoCanvasRelations) {
              void util.createExistingRelations({
                shape: shape as DiscourseNodeShape,
              });
            }
          }
        });

      return () => {
        removeBeforeChangeHandler();
        removeAfterCreateHandler();
      };
    };
    const cleanupCustomSideEffects = registerCustomSideEffects();
    const [cleanupSideEffects] = registerDefaultSideEffects(editor);

    return () => {
      cleanupSideEffects();
      cleanupCustomSideEffects();
    };
  }, [editor, msg, toasts]);

  return <CustomContextMenu extensionAPI={extensionAPI} allNodes={allNodes} />;
};

const renderTldrawCanvasHelper = ({
  title,
  onloadArgs,
  h1,
  rootSelector,
  minHeight,
  height,
}: {
  title: string;
  onloadArgs: OnloadArgs;
  h1: HTMLHeadingElement;
  rootSelector: string;
  minHeight: string;
  height: string;
}) => {
  // Find the root element using the H1 context to avoid scope issues
  const rootElement = h1.closest(rootSelector) as HTMLDivElement;
  if (!rootElement) return () => {};

  const childFromRoot =
    rootElement.querySelector<HTMLDivElement>(".rm-block-children");
  if (!childFromRoot) return () => {};

  const canvasWrapperEl = document.createElement("div");
  if (
    childFromRoot &&
    childFromRoot.parentElement &&
    !childFromRoot.hasAttribute(TLDRAW_DATA_ATTRIBUTE)
  ) {
    rootElement.setAttribute(TLDRAW_DATA_ATTRIBUTE, "true");
    childFromRoot.setAttribute(TLDRAW_DATA_ATTRIBUTE, "true");
    const parentEl = childFromRoot.parentElement;
    parentEl.appendChild(canvasWrapperEl);
    canvasWrapperEl.style.minHeight = minHeight;
    canvasWrapperEl.style.height = height;
  }

  const unmount = renderWithUnmount(
    <ExtensionApiContextProvider {...onloadArgs}>
      <TldrawCanvas title={title} />
    </ExtensionApiContextProvider>,
    canvasWrapperEl,
  );

  const originalUnmount = unmount;
  return () => {
    originalUnmount();
    childFromRoot.removeAttribute(TLDRAW_DATA_ATTRIBUTE);
    rootElement.removeAttribute(TLDRAW_DATA_ATTRIBUTE);
    canvasWrapperEl.remove();
  };
};

export const renderTldrawCanvas = ({
  title,
  onloadArgs,
  h1,
}: {
  title: string;
  onloadArgs: OnloadArgs;
  h1: HTMLHeadingElement;
}) => {
  return renderTldrawCanvasHelper({
    title,
    onloadArgs,
    h1,
    rootSelector: ".roam-article",
    minHeight: "500px",
    height: "70vh",
  });
};

export const renderTldrawCanvasInSidebar = ({
  title,
  onloadArgs,
  h1,
}: {
  title: string;
  onloadArgs: OnloadArgs;
  h1: HTMLHeadingElement;
}) => {
  return renderTldrawCanvasHelper({
    title,
    onloadArgs,
    h1,
    rootSelector: ".rm-sidebar-outline",
    minHeight: "400px",
    height: "60vh",
  });
};
