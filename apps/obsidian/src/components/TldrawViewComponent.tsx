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
import { DiscourseNode } from "~/types";
import { openCreateDiscourseNodeAt } from "~/utils/nodeCreationFlow";
import { ExistingNodeSearch } from "./ExistingNodeSearch";

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
  // Inline SVG so we don't rely on vault paths for toolbar icon
  const WHITE_SVG =
    '<svg width="18" height="19" viewBox="0 0 256 264" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M156.705 252.012C140.72 267.995 114.803 267.995 98.8183 252.012L11.9887 165.182C-3.99622 149.197 -3.99622 123.28 11.9886 107.296L55.4035 63.8807C63.3959 55.8881 76.3541 55.8881 84.3467 63.8807C92.3391 71.8731 92.3391 84.8313 84.3467 92.8239L69.8751 107.296C53.8901 123.28 53.8901 149.197 69.8751 165.182L113.29 208.596C121.282 216.589 134.241 216.589 142.233 208.596C150.225 200.604 150.225 187.646 142.233 179.653L127.761 165.182C111.777 149.197 111.777 123.28 127.761 107.296C143.746 91.3105 143.746 65.3939 127.761 49.4091L113.29 34.9375C105.297 26.9452 105.297 13.9868 113.29 5.99432C121.282 -1.99811 134.241 -1.99811 142.233 5.99434L243.533 107.296C259.519 123.28 259.519 149.197 243.533 165.182L156.705 252.012ZM200.119 121.767C192.127 113.775 179.168 113.775 171.176 121.767C163.184 129.76 163.184 142.718 171.176 150.71C179.168 158.703 192.127 158.703 200.119 150.71C208.112 142.718 208.112 129.76 200.119 121.767Z" fill="white"/></svg>';

  const svgToDataUrl = (svg: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  const [iconUrl, setIconUrl] = useState<string>(() => {
    const isDark = document.body.classList.contains("theme-dark");
    const svg = isDark
      ? WHITE_SVG
      : WHITE_SVG.replace('fill="white"', 'fill="black"');
    return svgToDataUrl(svg);
  });

  useEffect(() => {
    const updateIcon = () => {
      const isDark = document.body.classList.contains("theme-dark");
      const svg = isDark
        ? WHITE_SVG
        : WHITE_SVG.replace('fill="white"', 'fill="black"');
      setIconUrl(svgToDataUrl(svg));
    };
    const ref = plugin.app.workspace.on("css-change", updateIcon);
    return () => {
      if (ref) plugin.app.workspace.offref(ref);
    };
  }, [plugin]);

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
    <div
      ref={containerRef}
      className="tldraw__editor relative h-full"
      onDropCapture={(e) => {
        const editor = editorRef.current;
        if (!editor) return;

        const nodeTypeId = e.dataTransfer?.getData(
          "application/x-dg-node-type",
        );
        if (!nodeTypeId) return;

        e.preventDefault();
        e.stopPropagation();

        const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });

        const nodeType = plugin.settings.nodeTypes.find(
          (nt) => nt.id === nodeTypeId,
        );
        if (!nodeType) return;

        openCreateDiscourseNodeAt({
          plugin,
          canvasFile: file,
          tldrawEditor: editor,
          position: pagePoint,
          initialNodeType: nodeType,
        });
      }}
    >
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

                return <DiscourseNodePanel plugin={plugin} canvasFile={file} />;
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
            }}
          />
        </ErrorBoundary>
      ) : (
        <div>Loading Tldraw...</div>
      )}
    </div>
  );
};