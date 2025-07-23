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
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedDataRef = useRef<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const saveChanges = useCallback(async () => {
    if (isSaving) return; // Prevent concurrent saves

    try {
      setIsSaving(true);
      const newData = await updateFileData(plugin, store);
      const stringifiedData = JSON.stringify(newData, null, "\t");

      if (stringifiedData === lastSavedDataRef.current) {
        return;
      }

      const currentContent = await plugin.app.vault.read(file);
      if (!currentContent) {
        throw new Error("Could not read file content");
      }

      const updatedString = replaceBetweenKeywords(
        currentContent,
        TLDATA_DELIMITER_START,
        TLDATA_DELIMITER_END,
        stringifiedData,
      );

      if (updatedString === currentContent) {
        return;
      }

      await plugin.app.vault.modify(file, updatedString);
      lastSavedDataRef.current = stringifiedData;

      // Verify save
      const verifyContent = await plugin.app.vault.read(file);
      if (!verifyContent.includes(stringifiedData)) {
        throw new Error("Save verification failed");
      }
    } catch (error) {
      console.error("Error saving TLDraw data:", error);
      // Attempt to reload the editor state from file
      try {
        const fileContent = await plugin.app.vault.read(file);
        const match = fileContent.match(
          new RegExp(
            `${TLDATA_DELIMITER_START}([\\s\\S]*?)${TLDATA_DELIMITER_END}`,
          ),
        );
        if (match?.[1]) {
          const data = JSON.parse(match[1]);
          if (data.raw) {
            store.loadSnapshot(data.raw);
          }
        }
      } catch (recoveryError) {
        console.error("Failed to recover editor state:", recoveryError);
      }
    } finally {
      setIsSaving(false);
    }
  }, [file, plugin, store]);

  useEffect(() => {
    const unsubscribe = store.listen(
      () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
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
  }, [store, saveChanges]);

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