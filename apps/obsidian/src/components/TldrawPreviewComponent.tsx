import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, ErrorBoundary, Tldraw, TLStore } from "tldraw";
import "tldraw/tldraw.css";

interface TldrawPreviewProps {
  store: TLStore;
  isReadonly?: boolean;
}

export const TldrawPreviewComponent = ({
  store,
  isReadonly = false,
}: TldrawPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const handleMount = useCallback((editor: Editor) => {
    editor.setCurrentTool("hand");
    editor.updateInstanceState({});

    const shapes = editor.getCurrentPageShapes();
    if (shapes.length > 0) {
      editor.zoomToFit();
    }
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
          <Tldraw store={store} onMount={handleMount} autoFocus={false} />
        </ErrorBoundary>
      ) : (
        <div>Loading Tldraw...</div>
      )}
    </div>
  );
};
