// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atom, type Editor, type TLKeyboardEventInfo } from "tldraw";
import {
  finishTinyHandInteraction,
  listenForTinyHandInteraction,
} from "~/components/canvas/tinyHand/tinyHandInteraction";

const toolId = "dg-tiny-hand";
const setup = () => {
  let tool = toolId;
  const container = document.createElement("div");
  const canvas = document.createElement("div");
  container.append(canvas);
  document.body.append(container);
  const dispatch = vi.fn();
  const editor = {
    getContainer: () => container,
    getIsFocused: () => true,
    isIn: (id: string) => tool.split(".")[0] === id,
    setCurrentTool: (id: string) => {
      tool = id;
    },
    run: (action: () => void) => action(),
    complete: vi.fn(),
    cancel: vi.fn(),
    inputs: { altKey: false },
    dispatch,
  };
  const interacting = atom("test native interaction", false);
  const restorePointer = vi.fn();
  const dispose = listenForTinyHandInteraction({
    editor: editor as unknown as Editor,
    canvas,
    interacting,
    toolId,
    restorePointer,
  });
  Object.defineProperty(document, "elementFromPoint", {
    value: () => canvas,
    configurable: true,
  });
  const key = (
    type: string,
    key: string,
    target: EventTarget = container,
  ): void => {
    target.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        bubbles: true,
        cancelable: true,
        altKey: type === "keydown",
      }),
    );
  };
  const pointer = (type: string, altKey = false): void => {
    const event = new MouseEvent(type, {
      bubbles: true,
      altKey,
      clientX: 50,
      clientY: 70,
    });
    Object.assign(event, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    });
    canvas.dispatchEvent(event);
  };
  return {
    container,
    canvas,
    editor,
    dispatch,
    interacting,
    restorePointer,
    dispose,
    key,
    pointer,
    tool: () => tool,
  };
};

describe("TinyHand native interaction", () => {
  let fixture: ReturnType<typeof setup>;
  beforeEach(() => {
    vi.useFakeTimers();
    fixture = setup();
  });
  afterEach(() => {
    fixture.dispose();
    fixture.container.remove();
    vi.useRealTimers();
  });

  it("borrows Select, consumes its duplicate modifier and restores the hand at the current pointer", () => {
    const {
      key,
      pointer,
      editor,
      dispatch,
      interacting,
      restorePointer,
      tool,
    } = fixture;
    const original: TLKeyboardEventInfo = {
      type: "keyboard",
      name: "key_down",
      key: "Shift",
      code: "ShiftLeft",
      altKey: true,
      shiftKey: true,
      ctrlKey: false,
    };
    key("keydown", "Alt");
    expect(interacting.get()).toBe(true);
    expect(tool()).toBe("select");
    editor.dispatch(original);
    expect(dispatch).toHaveBeenCalledWith({ ...original, altKey: false });
    expect(original.altKey).toBe(true);
    pointer("pointermove", true);
    key("keyup", "Alt", window);
    expect(restorePointer).toHaveBeenCalledWith({ x: 50, y: 70 });
    expect(tool()).toBe(toolId);
    expect(editor.dispatch).toBe(dispatch);
  });

  it("recovers from a key release swallowed inside a native control", () => {
    const { key, pointer, tool, interacting } = fixture;
    key("keydown", "Alt");
    pointer("pointermove", true);
    expect(interacting.get()).toBe(true);
    pointer("pointermove", false);
    expect(interacting.get()).toBe(false);
    expect(tool()).toBe(toolId);
  });

  it("recovers when an iframe receives pointerup and the canvas receives Alt-up", () => {
    const { key, pointer, tool } = fixture;
    key("keydown", "Alt");
    pointer("pointerdown", true);
    key("keyup", "Alt", window);
    expect(tool()).toBe("select");
    pointer("pointermove", false);
    expect(tool()).toBe(toolId);
  });

  it("leaves each pointer sequence with the tool where it began", () => {
    const { key, pointer, tool, canvas } = fixture;
    pointer("pointerdown");
    key("keydown", "Alt");
    expect(tool()).toBe(toolId);
    pointer("pointerup");
    vi.runAllTimers();
    expect(tool()).toBe("select");
    pointer("pointerdown");
    key("keyup", "Alt", window);
    pointer("pointerup");
    let toolAtClick: string | undefined;
    canvas.addEventListener("click", () => {
      toolAtClick = tool();
    });
    canvas.click();
    expect(toolAtClick).toBe("select");
    vi.runAllTimers();
    expect(tool()).toBe(toolId);
  });

  it("restores on window blur and leaves explicit tool choices in place", () => {
    const { key, editor, tool, interacting } = fixture;
    key("keydown", "Alt");
    window.dispatchEvent(new Event("blur"));
    expect(tool()).toBe(toolId);
    key("keydown", "Alt");
    editor.setCurrentTool("draw");
    key("keyup", "Alt", window);
    expect(tool()).toBe("draw");
    expect(interacting.get()).toBe(false);
    editor.setCurrentTool(toolId);
    key("keydown", "Alt");
    finishTinyHandInteraction(editor as unknown as Editor);
    key("keyup", "Alt", window);
    expect(tool()).toBe("select");
  });

  it("respects text fields and exits TinyHand with Escape during interaction", () => {
    const { container, key, tool, interacting } = fixture;
    const input = document.createElement("textarea");
    container.append(input);
    key("keydown", "Alt", input);
    expect(interacting.get()).toBe(false);
    key("keydown", "Alt");
    key("keydown", "Escape");
    key("keyup", "Alt", window);
    expect(interacting.get()).toBe(false);
    expect(tool()).toBe("select.idle");
  });
});
