import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultShapeUtils,
  DefaultToolbar,
  DefaultToolbarContent,
  ErrorBoundary,
  Tldraw,
  TldrawUiMenuItem,
  TLStore,
  Editor,
  useIsToolSelected,
  useTools,
  defaultBindingUtils,
  TLPointerEventInfo,
  DefaultSharePanel,
  type TLDefaultExternalContentHandlerOpts,
  type TLUiToast,
} from "tldraw";
import "tldraw/tldraw.css";
import {
  getTLDataTemplate,
  createRawTldrawFile,
  getUpdatedMdContent,
  processInitialData,
} from "~/components/canvas/utils/tldraw";
import { DEFAULT_SAVE_DELAY } from "~/constants";
import {
  applyCanvasFileState,
  CanvasFileState,
  parseCanvasFileState,
} from "~/components/canvas/utils/canvasFileSync";
import { useCanvasFileSync } from "~/components/canvas/hooks/useCanvasFileSync";
import { Notice, TFile } from "obsidian";
import { ObsidianTLAssetStore } from "~/components/canvas/stores/assetStore";
import {
  createDiscourseNodeUtil,
  DiscourseNodeShape,
} from "~/components/canvas/shapes/DiscourseNodeShape";
import { DiscourseNodeTool } from "./DiscourseNodeTool";
import { DiscourseToolPanel } from "./DiscourseToolPanel";
import { usePlugin } from "~/components/PluginContext";
import { createDiscourseRelationUtil } from "~/components/canvas/shapes/DiscourseRelationShape";
import { DiscourseRelationTool } from "./DiscourseRelationTool";
import {
  DiscourseRelationBindingUtil,
  BaseRelationBindingUtil,
} from "~/components/canvas/shapes/DiscourseRelationBinding";
import ToastListener from "./ToastListener";
import { RelationsOverlay } from "./overlays/RelationOverlay";
import { DragHandleOverlay } from "./overlays/DragHandleOverlay";
import { WHITE_LOGO_SVG } from "~/icons";
import { CustomContextMenu } from "./CustomContextMenu";
import {
  openFileInSidebar,
  openFileInNewTab,
  openFileInNewLeaf,
  resolveDiscourseNodeFile,
} from "./utils/openFileUtils";
import { handleExternalUrlContent } from "./utils/externalContentHandlers";
type TldrawPreviewProps = {
  store: TLStore;
  file: TFile;
  assetStore: ObsidianTLAssetStore;
  canvasUuid: string;
  initialFileState: CanvasFileState | null;
};

type SaveResult = "saved" | "skipped" | "retry";

export const TldrawPreviewComponent = ({
  store,
  file,
  assetStore,
  canvasUuid,
  initialFileState,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStore, setCurrentStore] = useState<TLStore>(store);
  const [isReady, setIsReady] = useState(false);
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const isCreatingRelationRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const isSavingRef = useRef<boolean>(false);
  const lastShiftClickRef = useRef<number>(0);
  const SHIFT_CLICK_DEBOUNCE_MS = 300; // Prevent double clicks within 300ms
  // The file as this tab last agreed with it: seeded at mount, set before each
  // of our writes, and replaced after each external change we merge in.
  const lastKnownFileRef = useRef<CanvasFileState | null>(initialFileState);
  const editorRef = useRef<Editor>(null);
  const plugin = usePlugin();

  useCanvasFileSync({
    file,
    store: currentStore,
    lastKnownFileRef,
    isSavingRef,
  });

  const customShapeUtils = [
    ...defaultShapeUtils,
    createDiscourseNodeUtil({
      app: plugin.app,
      canvasFile: file,
      plugin,
    }),
    createDiscourseRelationUtil({
      app: plugin.app,
      canvasFile: file,
      plugin,
    }),
  ];

  const customTools = [DiscourseNodeTool, DiscourseRelationTool];

  const iconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(WHITE_LOGO_SVG)}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  // Add keyboard event listener for Meta+Alt+Enter when editor is mounted
  useEffect(() => {
    if (!isEditorMounted || !editorRef.current) return;

    const editor = editorRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Meta+Alt+Enter (Command+Alt+Enter on Mac)
      if (
        e.key === "Enter" &&
        e.metaKey &&
        e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey
      ) {
        const hoveredShapeId = editor.getHoveredShapeId();
        if (!hoveredShapeId) return;

        const hoveredShape = editor.getShape(hoveredShapeId);
        if (!hoveredShape || hoveredShape.type !== "discourse-node") return;

        const shape = hoveredShape as DiscourseNodeShape;
        void (async () => {
          const linkedFile = await resolveDiscourseNodeFile(
            shape,
            file,
            plugin.app,
          );

          if (!linkedFile) return;

          await openFileInNewLeaf(plugin.app, linkedFile);
          editor.selectNone();
        })();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isEditorMounted, file, plugin]);

  const saveChanges = useCallback(async (): Promise<SaveResult> => {
    // Prevent concurrent saves
    if (isSavingRef.current || !canvasUuid) {
      return "skipped";
    }

    isSavingRef.current = true;
    try {
      const newData = getTLDataTemplate({
        pluginVersion: plugin.manifest.version,
        tldrawFile: createRawTldrawFile(currentStore),
        uuid: canvasUuid,
      });
      const stringifiedData = JSON.stringify(newData, null, "\t");

      if (stringifiedData === lastKnownFileRef.current?.text) {
        return "skipped";
      }

      const currentContent = await plugin.app.vault.read(file);
      if (!currentContent) {
        console.error("Could not read file content");
        return "skipped";
      }

      // Never overwrite a version of the file this tab has not merged. Merge
      // it in and ask the caller to retry so the next write carries both.
      const onDisk = parseCanvasFileState(currentContent);
      if (onDisk && onDisk.text !== lastKnownFileRef.current?.text) {
        const applied = applyCanvasFileState({
          store: currentStore,
          base: lastKnownFileRef.current,
          incoming: onDisk,
        });
        if (applied) {
          lastKnownFileRef.current = onDisk;
        }
        return "retry";
      }

      const updatedString = getUpdatedMdContent(
        currentContent,
        stringifiedData,
      );
      if (updatedString === currentContent) {
        return "skipped";
      }

      // Recorded before the write so the vault `modify` event it triggers is
      // recognised as our own and not merged back in.
      const previousState = lastKnownFileRef.current;
      lastKnownFileRef.current = { text: stringifiedData, data: newData };

      try {
        await plugin.app.vault.modify(file, updatedString);

        const savedState = parseCanvasFileState(
          await plugin.app.vault.read(file),
        );
        if (!savedState) {
          throw new Error(
            "Failed to verify saved TLDraw data: Could not find data block",
          );
        }
        if (JSON.stringify(savedState.data) !== JSON.stringify(newData)) {
          console.warn(
            "Saved data differs from expected (this is normal during concurrent operations)",
          );
        }
        return "saved";
      } catch (error) {
        lastKnownFileRef.current = previousState;
        console.error("Error saving/verifying TLDraw data:", error);
        // Reload the editor state from file since save failed
        const fileState = parseCanvasFileState(
          await plugin.app.vault.read(file),
        );
        if (fileState) {
          const { store: newStore } = processInitialData(
            fileState.data,
            assetStore,
            {
              app: plugin.app,
              canvasFile: file,
              plugin,
            },
          );
          lastKnownFileRef.current = fileState;
          setCurrentStore(newStore);
        }
        return "skipped";
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [file, plugin, currentStore, assetStore, canvasUuid]);

  useEffect(() => {
    const scheduleSave = (): void => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        // If a save is already in progress, try again after it completes
        if (isSavingRef.current) {
          scheduleSave();
          return;
        }
        void saveChanges().then((result) => {
          if (result === "retry") scheduleSave();
        });
      }, DEFAULT_SAVE_DELAY);
    };

    const unsubscribe = currentStore.listen(scheduleSave, {
      source: "user",
      scope: "document",
    });

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentStore, saveChanges]);

  const handleMount = (editor: Editor) => {
    editorRef.current = editor;
    setIsEditorMounted(true);

    editor.registerExternalContentHandler("url", (externalContent) => {
      void handleExternalUrlContent({
        editor,
        url: externalContent.url,
        point: externalContent.point,
        plugin,
        canvasFile: file,
        defaultHandlerOpts: {
          toasts: {
            addToast: (t: Omit<TLUiToast, "id"> & { id?: string }) => {
              new Notice(t.description ?? t.title ?? "Error");
              return "";
            },
            removeToast: () => "",
            clearToasts: () => {},
            toasts: { get: () => [], update: () => {} },
          },
          msg: (key?: string) => key ?? "",
        } as unknown as TLDefaultExternalContentHandlerOpts,
      });
    });

    editor.on("event", (event) => {
      // Handle pointer events
      if (event.type !== "pointer") return;
      const e = event as TLPointerEventInfo;

      if (e.type === "pointer" && e.name === "right_click") {
        const container = editor.getContainer();
        const canvas = container?.querySelector(".tl-canvas") as HTMLElement;

        if (canvas) {
          setTimeout(() => {
            const contextMenuEvent = new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: e.point.x,
              clientY: e.point.y,
              button: 2,
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              altKey: e.altKey,
              metaKey: e.metaKey,
            });
            canvas.dispatchEvent(contextMenuEvent);
          }, 0);
        }
      }

      if (e.type === "pointer" && e.name === "pointer_down") {
        const currentTool = editor.getCurrentTool();
        const currentToolId = currentTool.id;

        if (currentToolId === "discourse-relation") {
          isCreatingRelationRef.current = true;
        }
      }

      if (e.type === "pointer" && e.name === "pointer_up") {
        if (isCreatingRelationRef.current) {
          BaseRelationBindingUtil.checkAndReifyRelation(editor);
          isCreatingRelationRef.current = false;
        }

        // Handle Shift+Click (open in sidebar) or Cmd+Click (open in new tab)
        if (e.shiftKey || e.metaKey) {
          const now = Date.now();
          const openInNewTab = e.metaKey; // Cmd on Mac, Ctrl on other platforms

          // Debounce to prevent double opening
          if (now - lastShiftClickRef.current < SHIFT_CLICK_DEBOUNCE_MS) {
            return;
          }
          lastShiftClickRef.current = now;

          const shapeAtPoint = editor.getShapeAtPoint(
            editor.inputs.currentPagePoint,
          );

          if (!shapeAtPoint || shapeAtPoint.type !== "discourse-node") return;
          const shape = shapeAtPoint as DiscourseNodeShape;
          const selectedShapes = editor.getSelectedShapes();
          const selectedDiscourseNodes = selectedShapes.filter(
            (s) => s.type === "discourse-node",
          );

          if (selectedDiscourseNodes.length > 1) {
            return;
          }

          void (async () => {
            const linkedFile = await resolveDiscourseNodeFile(
              shape,
              file,
              plugin.app,
            );

            if (!linkedFile) return;

            // Open in sidebar (Shift+Click) or new tab (Cmd+Click)
            if (openInNewTab) {
              await openFileInNewTab(plugin.app, linkedFile);
            } else {
              await openFileInSidebar(plugin.app, linkedFile);
            }
            editor.selectNone();
          })();
        }
      }
    });
  };

  return (
    <div ref={containerRef} className="tldraw__editor relative h-full">
      {isReady ? (
        <ErrorBoundary
          fallback={({ error }) => (
            <div>Error in Tldraw component: {JSON.stringify(error)}</div>
          )}
        >
          <Tldraw
            store={currentStore}
            autoFocus={true}
            onMount={handleMount}
            initialState="select"
            shapeUtils={customShapeUtils}
            tools={customTools}
            bindingUtils={[
              ...defaultBindingUtils,
              DiscourseRelationBindingUtil,
            ]}
            assetUrls={{
              icons: {
                discourseNodeIcon: iconUrl,
              },
            }}
            overrides={{
              tools: (editor, tools) => {
                tools["discourse-node"] = {
                  id: "discourse-node",
                  label: "Discourse node",
                  readonlyOk: false,
                  icon: "discourseNodeIcon",
                  onSelect: () => {
                    editor.setCurrentTool("discourse-node");
                  },
                };
                tools["discourse-relation"] = {
                  id: "discourse-relation",
                  label: "Discourse relation",
                  readonlyOk: false,
                  icon: "tool-arrow",
                  onSelect: () => {
                    editor.setCurrentTool("discourse-relation");
                  },
                };
                return tools;
              },
            }}
            components={{
              ContextMenu: (props) => (
                <CustomContextMenu canvasFile={file} props={props} />
              ),
              SharePanel: () => {
                const tools = useTools();
                const isDiscourseNodeToolSelected = useIsToolSelected(
                  tools["discourse-node"],
                );
                const isDiscourseRelationToolSelected = useIsToolSelected(
                  tools["discourse-relation"],
                );
                if (
                  isDiscourseNodeToolSelected ||
                  isDiscourseRelationToolSelected
                ) {
                  return (
                    <DiscourseToolPanel plugin={plugin} canvasFile={file} />
                  );
                }
                return <DefaultSharePanel />;
              },

              OnTheCanvas: () => <ToastListener canvasId={file.path} />,
              Toolbar: (props) => {
                const tools = useTools();
                const isDiscourseNodeSelected = useIsToolSelected(
                  tools["discourse-node"],
                );
                return (
                  <DefaultToolbar {...props}>
                    <TldrawUiMenuItem
                      id="discourse-node"
                      icon="discourseNodeIcon"
                      label="Discourse Graph"
                      onSelect={() => {
                        if (editorRef.current) {
                          editorRef.current.setCurrentTool("discourse-node");
                        }
                      }}
                      isSelected={isDiscourseNodeSelected}
                    />
                    <DefaultToolbarContent />
                  </DefaultToolbar>
                );
              },
              InFrontOfTheCanvas: () => (
                <>
                  <RelationsOverlay plugin={plugin} file={file} />
                  <DragHandleOverlay plugin={plugin} file={file} />
                </>
              ),
            }}
          />
        </ErrorBoundary>
      ) : (
        <div>Loading Tldraw...</div>
      )}
    </div>
  );
};
