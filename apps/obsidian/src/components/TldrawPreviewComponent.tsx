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
import { DefaultCanvas } from "@tldraw/editor";
import type DiscourseGraphPlugin from "~/index";

interface TldrawPreviewProps {
  plugin: DiscourseGraphPlugin;
  store: TLStore;
  isReadonly?: boolean;
}

export const TldrawPreviewComponent = ({
  plugin,
  store,
  isReadonly = true,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Delay the mount to ensure proper context initialization
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const handleMount = useCallback((editor: Editor) => {
    editor.setCurrentTool("hand");
    editor.updateInstanceState({
      isReadonly: true,
      isFocusMode: false,
      isGridMode: false,
      isDebugMode: false,
    });
    editor.zoomToFit();
  }, []);

  return (
    <div
      ref={containerRef}
      className="tldraw-container"
      style={{ flex: 1, height: "100%" }}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {isReady ? (
        <ErrorBoundary
          fallback={({ error }) => (
            <div>Error in Tldraw component: {JSON.stringify(error)}</div>
          )}
        >
          <Tldraw store={store} autoFocus={false} />
        </ErrorBoundary>
      ) : (
        <div>Loading Tldraw...</div>
      )}
    </div>
  );
};
