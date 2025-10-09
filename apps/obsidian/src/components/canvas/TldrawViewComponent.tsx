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
  WHITE_LOGO_SVG,
} from "~/constants";
import { TFile } from "obsidian";
import { ObsidianTLAssetStore } from "~/components/canvas/stores/assetStore";
import { createDiscourseNodeUtil } from "~/components/canvas/shapes/DiscourseNodeShape";
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

interface TldrawPreviewProps {
  store: TLStore;
  file: TFile;
  assetStore: ObsidianTLAssetStore;
}

// No longer needed - using tldraw's event system instead

export const TldrawPreviewComponent = ({
  store,
  file,
  assetStore,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStore, setCurrentStore] = useState<TLStore>(store);
  const [isReady, setIsReady] = useState(false);
  const isCreatingRelationRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
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
    const newData = getTLDataTemplate({
      pluginVersion: plugin.manifest.version,
      tldrawFile: createRawTldrawFile(currentStore),
      uuid: window.crypto.randomUUID(),
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

      if (!verifyMatch || verifyMatch[1]?.trim() !== stringifiedData.trim()) {
        throw new Error("Failed to verify saved TLDraw data");
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
  }, [file, plugin, currentStore, assetStore]);

  useEffect(() => {
    const unsubscribe = currentStore.listen(
      () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(
          () => void saveChanges(),
          DEFAULT_SAVE_DELAY,
        );
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
              OnTheCanvas: () => <ToastListener />,
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
                      label="Discourse Node"
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
