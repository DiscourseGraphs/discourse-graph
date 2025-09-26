import { useEffect, useState } from "react";
import { TFile } from "obsidian";
import { useEditor, useValue } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";
import { RelationsPanel } from "~/components/canvas/overlays/RelationPanel";

type RelationsOverlayProps = {
  plugin: DiscourseGraphPlugin;
  file: TFile;
};

export const RelationsOverlay = ({ plugin, file }: RelationsOverlayProps) => {
  const editor = useEditor();
  const [isOpen, setIsOpen] = useState(false);

  // Currently selected discourse-node shape (first one found)
  const selectedNode = useValue<DiscourseNodeShape | null>(
    "selectedDiscourseNode",
    () => {
      const shape = editor.getOnlySelectedShape();
      if (shape && shape.type === "discourse-node") {
        return shape as DiscourseNodeShape;
      }
      return null;
    },
    [editor],
  );

  // Close the panel if selection is cleared or not a discourse-node
  useEffect(() => {
    if (!selectedNode) setIsOpen(false);
  }, [selectedNode]);

  // Compute viewport position for the floating button (center-top of selection)
  const buttonPosition = useValue<{ left: number; top: number } | null>(
    "relationsButtonPosition",
    () => {
      if (!selectedNode) return null;
      const bounds = editor.getSelectionRotatedPageBounds();
      if (!bounds) return null;

      const topLeft = editor.pageToViewport({ x: bounds.minX, y: bounds.minY });
      const topRight = editor.pageToViewport({
        x: bounds.maxX,
        y: bounds.minY,
      });
      const width = topRight.x - topLeft.x;
      const left = topLeft.x + width / 2;
      const top = topLeft.y - 8; // a bit above the shape
      return { left, top };
    },
    [editor, selectedNode?.id],
  );

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const showButton = !!selectedNode && !!buttonPosition && !isOpen;

  return (
    <div
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      // Container overlay above the canvas
    >
      {showButton && (
        <button
          onClick={handleOpen}
          style={{
            left: `${buttonPosition.left}px`,
            top: `${buttonPosition.top}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "all",
          }}
          className="absolute z-10 rounded px-3 py-1 text-xs text-white"
        >
          Relations
        </button>
      )}

      {isOpen && selectedNode && (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            maxHeight: "calc(100% - 24px)",
            pointerEvents: "all",
            overflow: "auto",
            zIndex: 10,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <RelationsPanel
            nodeShape={selectedNode}
            plugin={plugin}
            canvasFile={file}
            onClose={handleClose}
          />
        </div>
      )}
    </div>
  );
};
