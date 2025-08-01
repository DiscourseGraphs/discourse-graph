import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultShapeUtils,
  ErrorBoundary,
  Tldraw,
  TLStore,
  useTools,
  TldrawUiMenuItem,
  DefaultToolbar,
  DefaultToolbarContent,
  useIsToolSelected,
  DefaultStylePanel,
  Editor,
} from "tldraw";
import "tldraw/tldraw.css";
import {
  getTLDataTemplate,
  createRawTldrawFile,
  getUpdatedMdContent,
  TLData,
  processInitialData,
} from "~/utils/tldraw";
import DiscourseGraphPlugin from "~/index";
import {
  DEFAULT_SAVE_DELAY,
  TLDATA_DELIMITER_END,
  TLDATA_DELIMITER_START,
} from "~/constants";
import { TFile } from "obsidian";
import { ObsidianTLAssetStore } from "~/utils/assetStore";
import { DiscourseNodeUtil } from "~/utils/shapes/DiscourseNodeShape";
import { DiscourseNodePanel } from "./DiscourseNodePanel";
import { DiscourseNodeTool } from "~/utils/DiscourseNodeTool";

interface TldrawPreviewProps {
  store: TLStore;
  plugin: DiscourseGraphPlugin;
  file: TFile;
  assetStore: ObsidianTLAssetStore;
}

export const TldrawPreviewComponent = ({
  store,
  plugin,
  file,
  assetStore,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStore, setCurrentStore] = useState<TLStore>(store);
  const [isReady, setIsReady] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedDataRef = useRef<string>("");
  const editorRef = useRef<Editor | null>(null);

  const customShapeUtils = [
    ...defaultShapeUtils,
    DiscourseNodeUtil.configure({
      app: plugin.app,
      canvasFile: file,
      plugin,
    }),
  ];
  const customTools = [DiscourseNodeTool];

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
            onMount={handleMount}
            autoFocus={true}
            initialState="select"
            shapeUtils={customShapeUtils}
            tools={customTools}
            assetUrls={{
              icons: {
                "discourse-node-icon":
                  plugin.app.vault.adapter.getResourcePath("white-logo.svg"),
              },
            }}
            overrides={{
              tools: (editor, tools) => {
                tools["discourse-node"] = {
                  id: "discourse-node",
                  label: "Discourse Node",
                  readonlyOk: false,
                  icon: "box",
                  onSelect: () => {
                    editor.setCurrentTool("discourse-node");
                  },
                };
                console.log("tools", tools);
                return tools;
              },
            }}
            components={{
              StylePanel: () => {
                const tools = useTools();
                const isDiscourseNodeSelected = useIsToolSelected(
                  tools["discourse-node"],
                );

                if (!isDiscourseNodeSelected) {
                  return <DefaultStylePanel />;
                }

                return <DiscourseNodePanel plugin={plugin} />;
              },
              Toolbar: (props) => {
                const tools = useTools();
                const isDiscourseNodeSelected = useIsToolSelected(
                  tools["discourse-node"],
                );
                return (
                  <DefaultToolbar {...props}>
                    <TldrawUiMenuItem
                      id="discourse-node"
                      icon="box"
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
            }}
          />
        </ErrorBoundary>
      ) : (
        <div>Loading Tldraw...</div>
      )}
    </div>
  );
};