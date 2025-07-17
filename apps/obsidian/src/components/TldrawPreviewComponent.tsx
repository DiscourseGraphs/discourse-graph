"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ContextMenu,
  Editor,
  ErrorBoundary,
  Tldraw,
  TldrawEditor,
  TldrawUi,
  TLStore,
} from "tldraw";
import { DefaultCanvas, getSnapshot } from "@tldraw/editor";
import type DiscourseGraphPlugin from "~/index";
import "tldraw/tldraw.css";

interface TldrawPreviewProps {
  plugin: DiscourseGraphPlugin;
  store: TLStore;
  isReadonly?: boolean;
}

export const TldrawPreviewComponent = ({
  store,
  isReadonly = false,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Delay the mount to ensure proper context initialization
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const handleMount = useCallback(
    (editor: Editor) => {
      // Set initial editor state
      editor.setCurrentTool("hand");
      editor.updateInstanceState({});

      // Get initial snapshot to ensure store is properly loaded
      const snapshot = getSnapshot(editor.store);
      console.log("Initial editor snapshot:", snapshot);

      // Only zoom to fit if we have shapes
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length > 0) {
        editor.zoomToFit();
      }
    },
    [isReadonly],
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="tldraw__editor relative flex h-full w-full flex-1 overflow-hidden"
      onTouchStart={(e) => e.stopPropagation()}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {isReady ? (
        <ErrorBoundary
          fallback={({ error }) => (
            <div>Error in Tldraw component: {JSON.stringify(error)}</div>
          )}
        >
          <Tldraw store={store} onMount={handleMount} autoFocus={false} />
        </ErrorBoundary>
      ) : (
        <div>Loading Tldraw...</div>
      )}
    </div>
  );
};
