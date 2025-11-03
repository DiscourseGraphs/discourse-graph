import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultShapeUtils,
  DefaultStylePanel,
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
} from "tldraw";
import "tldraw/tldraw.css";
import {
  getTLDataTemplate,
  createRawTldrawFile,
  getUpdatedMdContent,
  TLData,
  processInitialData,
} from "~/components/canvas/utils/tldraw";
import {
  DEFAULT_SAVE_DELAY,
  TLDATA_DELIMITER_END,
  TLDATA_DELIMITER_START,
} from "~/constants";
import { TFile } from "obsidian";
import {
  ObsidianTLAssetStore,
  resolveLinkedTFileByBlockRef,
  extractBlockRefId,
} from "~/components/canvas/stores/assetStore";
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
import { showToast } from "./utils/toastUtils";
import { WHITE_LOGO_SVG } from "~/icons";
import { CustomContextMenu } from "./CustomContextMenu";

type TldrawPreviewProps = {
  store: TLStore;
  file: TFile;
  assetStore: ObsidianTLAssetStore;
  canvasUuid: string;
};

export const TldrawPreviewComponent = ({
  store,
  file,
  assetStore,
  canvasUuid,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStore, setCurrentStore] = useState<TLStore>(store);
  const [isReady, setIsReady] = useState(false);
  const isCreatingRelationRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const isSavingRef = useRef<boolean>(false);
  const lastShiftClickRef = useRef<number>(0);
  const SHIFT_CLICK_DEBOUNCE_MS = 300; // Prevent double clicks within 300ms
  const lastSavedDataRef = useRef<string>("");
  const editorRef = useRef<Editor>(null);
  const plugin = usePlugin();

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

  const saveChanges = useCallback(async () => {
    // Prevent concurrent saves
    if (isSavingRef.current) {
      return;
    }

    if (!canvasUuid) {
      return;
    }

    isSavingRef.current = true;

    const newData = getTLDataTemplate({
      pluginVersion: plugin.manifest.version,
      tldrawFile: createRawTldrawFile(currentStore),
      uuid: canvasUuid,
    });
    const stringifiedData = JSON.stringify(newData, null, "\t");

    if (stringifiedData === lastSavedDataRef.current) {
      return;
    }

    const currentContent = await plugin.app.vault.read(file);
    if (!currentContent) {
      console.error("Could not read file content");
      return;
    }

    const updatedString = getUpdatedMdContent(currentContent, stringifiedData);
    if (updatedString === currentContent) {
      return;
    }

    try {
      await plugin.app.vault.modify(file, updatedString);

      const verifyContent = await plugin.app.vault.read(file);
      const verifyMatch = verifyContent.match(
        new RegExp(
          `${TLDATA_DELIMITER_START}\\s*([\\s\\S]*?)\\s*${TLDATA_DELIMITER_END}`,
        ),
      );

      if (!verifyMatch) {
        throw new Error(
          "Failed to verify saved TLDraw data: Could not find data block",
        );
      }

      const savedData = JSON.parse(verifyMatch[1]?.trim() ?? "{}") as TLData;
      const expectedData = JSON.parse(
        stringifiedData?.trim() ?? "{}",
      ) as TLData;

      if (JSON.stringify(savedData) !== JSON.stringify(expectedData)) {
        console.warn(
          "Saved data differs from expected (this is normal during concurrent operations)",
        );
      }

      lastSavedDataRef.current = stringifiedData;
    } catch (error) {
      console.error("Error saving/verifying TLDraw data:", error);
      // Reload the editor state from file since save failed
      const fileContent = await plugin.app.vault.read(file);
      const match = fileContent.match(
        new RegExp(
          `${TLDATA_DELIMITER_START}([\\s\\S]*?)${TLDATA_DELIMITER_END}`,
        ),
      );
      if (match?.[1]) {
        const data = JSON.parse(match[1]) as TLData;
        const { store: newStore } = processInitialData(data, assetStore, {
          app: plugin.app,
          canvasFile: file,
          plugin,
        });
        setCurrentStore(newStore);
      }
    }
    isSavingRef.current = false;
  }, [file, plugin, currentStore, assetStore, canvasUuid]);

  useEffect(() => {
    const unsubscribe = currentStore.listen(
      () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          // If a save is already in progress, schedule another save after it completes
          if (isSavingRef.current) {
            saveTimeoutRef.current = setTimeout(
              () => void saveChanges(),
              DEFAULT_SAVE_DELAY,
            );
          } else {
            void saveChanges();
          }
        }, DEFAULT_SAVE_DELAY);
      },
      { source: "user", scope: "document" },
    );

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentStore, saveChanges]);

  const handleMount = (editor: Editor) => {
    editorRef.current = editor;

    editor.on("event", (event) => {
      const e = event as TLPointerEventInfo;
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

        if (e.shiftKey) {
          const now = Date.now();

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

          const blockRefId = extractBlockRefId(shape.props.src ?? undefined);
          if (!blockRefId) {
            showToast({
              severity: "warning",
              title: "Cannot open node",
              description: "No valid block reference found",
            });
            return;
          }

          const canvasFileCache = plugin.app.metadataCache.getFileCache(file);
          if (!canvasFileCache) {
            showToast({
              severity: "error",
              title: "Error",
              description: "Could not read canvas file",
            });
            return;
          }

          void resolveLinkedTFileByBlockRef({
            app: plugin.app,
            canvasFile: file,
            blockRefId,
            canvasFileCache,
          })
            .then(async (linkedFile) => {
              if (!linkedFile) {
                showToast({
                  severity: "warning",
                  title: "Cannot open node",
                  description: "Linked file not found",
                });
                return;
              }

              const rightSplit = plugin.app.workspace.rightSplit;
              const rightLeaf = plugin.app.workspace.getRightLeaf(false);

              if (rightLeaf) {
                if (rightSplit && rightSplit.collapsed) {
                  rightSplit.expand();
                }
                await rightLeaf.openFile(linkedFile);
                plugin.app.workspace.setActiveLeaf(rightLeaf);
              } else {
                const leaf = plugin.app.workspace.getLeaf("split", "vertical");
                await leaf.openFile(linkedFile);
                plugin.app.workspace.setActiveLeaf(leaf);
              }

              editor.selectNone();
            })
            .catch((error) => {
              console.error("Error opening linked file:", error);
              showToast({
                severity: "error",
                title: "Error",
                description: "Failed to open linked file",
              });
            });
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
                  label: "Discourse Node",
                  readonlyOk: false,
                  icon: "discourseNodeIcon",
                  onSelect: () => {
                    editor.setCurrentTool("discourse-node");
                  },
                };
                tools["discourse-relation"] = {
                  id: "discourse-relation",
                  label: "Discourse Relation",
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
              /* eslint-disable @typescript-eslint/naming-convention */
              ContextMenu: (props) => (
                <CustomContextMenu canvasFile={file} props={props} />
              ),

              StylePanel: () => {
                const tools = useTools();
                const isDiscourseNodeSelected = useIsToolSelected(
                  tools["discourse-node"],
                );
                const isDiscourseRelationSelected = useIsToolSelected(
                  tools["discourse-relation"],
                );

                if (!isDiscourseNodeSelected && !isDiscourseRelationSelected) {
                  return <DefaultStylePanel />;
                }

                return <DiscourseToolPanel plugin={plugin} canvasFile={file} />;
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
                <RelationsOverlay plugin={plugin} file={file} />
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
