import * as React from "react";
import { Editor, Tldraw, TLStore } from "tldraw";
import type DiscourseGraphPlugin from "~/index";

interface TldrawPreviewProps {
  plugin: DiscourseGraphPlugin;
  store: TLStore;
  isReadonly?: boolean;
}

export function TldrawPreviewComponent({
  plugin,
  store,
  isReadonly = true,
}: TldrawPreviewProps) {
  const [editor, setEditor] = React.useState<Editor>();

  // When editor mounts, zoom to fit content
  React.useEffect(() => {
    if (editor) {
      editor.zoomToFit();
      editor.updateInstanceState({
        isReadonly: true,
        isFocusMode: false,
        isGridMode: false,
        isDebugMode: false,
      });
    }
  }, [editor]);

  return (
    <div
      className="tldraw-container"
      style={{ flex: 1, height: "100%" }}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <Tldraw
        store={store}
        onMount={setEditor}
        hideUi={isReadonly}
        tools={[]}
        className="tldraw-canvas"
        autoFocus={false}
      />
    </div>
  );
}
