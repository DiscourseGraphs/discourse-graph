// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Editor, TLUiToast } from "tldraw";
import {
  isRelationDrawable,
  promptReloadIfUndrawable,
} from "~/components/canvas/relationReload";

const editorWith = (types: string[]): Editor =>
  ({
    shapeUtils: Object.fromEntries(types.map((t) => [t, {}])),
  }) as unknown as Editor;

const captureToasts = (): { toasts: TLUiToast[]; stop: () => void } => {
  const toasts: TLUiToast[] = [];
  const listener = ((event: CustomEvent<TLUiToast>) => {
    toasts.push(event.detail);
  }) as EventListener;
  document.addEventListener("show-toast", listener);
  return {
    toasts,
    stop: () => document.removeEventListener("show-toast", listener),
  };
};

describe("relationReload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("treats only registered shape types as drawable", () => {
    const editor = editorWith(["rel-a"]);
    expect(isRelationDrawable(editor, "rel-a")).toBe(true);
    expect(isRelationDrawable(editor, "rel-new")).toBe(false);
  });

  it("does not prompt when the relation is already registered", () => {
    const { toasts, stop } = captureToasts();
    const prompted = promptReloadIfUndrawable({
      editor: editorWith(["rel-a"]),
      relationId: "rel-a",
      title: "Discourse relation added",
      description: "Supports added",
    });
    stop();
    expect(prompted).toBe(false);
    expect(toasts).toHaveLength(0);
  });

  it("prompts a persistent reload toast for an unregistered relation", () => {
    const { toasts, stop } = captureToasts();
    const prompted = promptReloadIfUndrawable({
      editor: editorWith(["rel-a"]),
      relationId: "rel-new",
      title: "Discourse relation added",
      description: "Supports added",
    });
    stop();
    expect(prompted).toBe(true);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      id: "tldraw-relation-needs-reload",
      title: "Discourse relation added",
      keepOpen: true,
    });
    expect(toasts[0].description).toContain("Reload to draw it");
    expect(toasts[0].actions?.map((a) => a.label)).toEqual(["Reload"]);
  });
});
