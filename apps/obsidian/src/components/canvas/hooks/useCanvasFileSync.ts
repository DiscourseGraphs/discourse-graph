import { MutableRefObject, useEffect } from "react";
import { TFile } from "obsidian";
import { TLStore } from "tldraw";
import { usePlugin } from "~/components/PluginContext";
import { CANVAS_FILE_SYNC_DEBOUNCE_MS } from "~/constants";
import {
  applyCanvasFileState,
  CanvasFileState,
  parseCanvasFileState,
} from "~/components/canvas/utils/canvasFileSync";

type UseCanvasFileSyncArgs = {
  file: TFile;
  store: TLStore;
  lastKnownFileRef: MutableRefObject<CanvasFileState | null>;
  isSavingRef: MutableRefObject<boolean>;
};

/**
 * Keeps the mounted store in step with its backing markdown file. The vault
 * `modify` event fires for every writer — another tab, a sync client, a hand
 * edit — so one listener covers all of them. Our own writes echo back through
 * the same event and are recognised by their text matching `lastKnownFileRef`.
 */
export const useCanvasFileSync = ({
  file,
  store,
  lastKnownFileRef,
  isSavingRef,
}: UseCanvasFileSyncArgs): void => {
  const plugin = usePlugin();

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    let disposed = false;

    const schedule = (fn: () => void): void => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(fn, CANVAS_FILE_SYNC_DEBOUNCE_MS);
    };

    const syncFromDisk = async (): Promise<void> => {
      const content = await plugin.app.vault.read(file);
      if (disposed) return;

      const incoming = parseCanvasFileState(content);
      if (!incoming) return;

      const base = lastKnownFileRef.current;
      if (base?.text === incoming.text) return;

      // A save in flight will re-read the file itself; let it settle first.
      if (isSavingRef.current) {
        schedule(() => void syncFromDisk());
        return;
      }

      if (applyCanvasFileState({ store, base, incoming })) {
        lastKnownFileRef.current = incoming;
      }
    };

    const modifyRef = plugin.app.vault.on("modify", (changed) => {
      if (!(changed instanceof TFile) || changed.path !== file.path) return;
      schedule(() => void syncFromDisk());
    });

    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
      plugin.app.vault.offref(modifyRef);
    };
  }, [file, store, plugin, lastKnownFileRef, isSavingRef]);
};
