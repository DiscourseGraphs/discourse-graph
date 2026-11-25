import { StateNode, TLStateNodeConstructor } from "tldraw";

export const TINY_HAND_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m14 14 7 7m-7-7 2.5-2.5a3 3 0 0 0 0-4.2L14 5l-2 2-4.2-4.2a1.4 1.4 0 0 0-2 2L9 8l-1.3-.4a1.4 1.4 0 0 0-1.4 2.3l3 3.2a4 4 0 0 0 4.7.9Z" fill="none" stroke="black" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)}`;

export const createTinyHandTool = (
  existingToolIds: readonly string[],
): TLStateNodeConstructor => {
  // Discourse relation labels are also registered as tool IDs.
  const baseId = "dg-tiny-hand";
  const usedIds = new Set(existingToolIds);
  let id = baseId;
  for (let suffix = 2; usedIds.has(id); suffix++) {
    id = `${baseId}-${suffix}`;
  }

  return class TinyHandTool extends StateNode {
    static override id = id;
    static override isLockable = false;

    override onCancel = (): void => {
      this.editor.setCurrentTool("select");
    };
  };
};
