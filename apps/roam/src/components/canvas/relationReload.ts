import type { Editor } from "tldraw";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";

export const isRelationDrawable = (
  editor: Editor,
  relationId: string,
): boolean => !!editor.shapeUtils[relationId];

// Relation shape utils register at canvas mount, so a schema saved after it needs a reload to draw.
export const promptReloadIfUndrawable = ({
  editor,
  relationId,
  title,
  description,
}: {
  editor: Editor;
  relationId: string;
  title: string;
  description: string;
}): boolean => {
  if (isRelationDrawable(editor, relationId)) return false;
  dispatchToastEvent({
    id: "tldraw-relation-needs-reload",
    title,
    description: `${description}. Reload to draw it on this canvas.`,
    severity: "success",
    keepOpen: true,
    actions: [
      {
        type: "primary",
        label: "Reload",
        onClick: () => window.location.reload(),
      },
    ],
  });
  return true;
};
