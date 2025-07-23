import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, ErrorBoundary, Tldraw, TLStore, useEditor } from "tldraw";
import "tldraw/tldraw.css";
import { replaceBetweenKeywords, updateFileData } from "~/utils/tldraw";
import DiscourseGraphPlugin from "..";
import {
  DEFAULT_SAVE_DELAY,
  TLDATA_DELIMITER_END,
  TLDATA_DELIMITER_START,
} from "~/constants";
import { TFile } from "obsidian";

interface TldrawPreviewProps {
  store: TLStore;
  plugin: DiscourseGraphPlugin;
  file: TFile;
}

export const TldrawPreviewComponent = ({
  store,
  plugin,
  file,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const saveChanges = async () => {
      try {
        const newData = await updateFileData(plugin, store);
        console.log("TLDraw data updated:", newData);
        const stringifiedData = JSON.stringify(newData, null, "\t");

        const currentContent = await plugin.app.vault.read(file);
        if (!currentContent) {
          console.error("Could not read file content");
          return;
        }

        const updatedString = replaceBetweenKeywords(
          currentContent,
          TLDATA_DELIMITER_START,
          TLDATA_DELIMITER_END,
          stringifiedData,
        );

        if (updatedString === currentContent) {
          console.log("No changes to save");
          return;
        }

        await plugin.app.vault.modify(file, updatedString);
      } catch (error) {
        console.error("Error updating TLDraw data:", error);
      }
    };

    const unsubscribe = store.listen(
      () => {
        // Clear any existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for debouncing
        saveTimeoutRef.current = setTimeout(saveChanges, DEFAULT_SAVE_DELAY);
      },
      { source: "user", scope: "document" },
    );

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [store, plugin, file]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    editor.setCurrentTool("select");
    editor.updateInstanceState({
      isReadonly: false,
      isDebugMode: false,
      isToolLocked: false,
      isGridMode: false,
    });

    const shapes = editor.getCurrentPageShapes();
    if (shapes.length > 0) {
      editor.zoomToFit();
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        editor.store.mergeRemoteChanges(() => {
          editor.updateInstanceState({
            isFocused: false,
            isPenMode: false,
          });
        });
      } else {
        editor.store.mergeRemoteChanges(() => {
          editor.updateInstanceState({
            isFocused: true,
            isPenMode: false,
          });
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="tldraw__editor relative flex h-full w-full flex-1 overflow-hidden"
      onTouchStart={(e) => e.stopPropagation()}
    >
      {isReady ? (
        <ErrorBoundary
          fallback={({ error }) => (
            <div>Error in Tldraw component: {JSON.stringify(error)}</div>
          )}
        >
          <Tldraw
            store={store}
            onMount={handleMount}
            autoFocus={false}
            hideUi={false}
          />
        </ErrorBoundary>
      ) : (
        <div>Loading Tldraw...</div>
      )}
    </div>
  );
};