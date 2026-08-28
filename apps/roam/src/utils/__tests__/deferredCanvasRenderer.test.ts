import { describe, expect, it, vi } from "vitest";
import { createDeferredCanvasRenderer } from "~/utils/deferredCanvasRenderer";

const createFrameScheduler = () => {
  const callbacks = new Map<number, () => void>();
  let nextFrameId = 1;

  const requestFrame = vi.fn((callback: () => void): number => {
    const frameId = nextFrameId++;
    callbacks.set(frameId, callback);
    return frameId;
  });
  const cancelFrame = vi.fn((frameId: number): void => {
    callbacks.delete(frameId);
  });
  const runFrame = (frameId: number): void => {
    const callback = callbacks.get(frameId);
    callbacks.delete(frameId);
    callback?.();
  };

  return { callbacks, requestFrame, cancelFrame, runFrame };
};

describe("createDeferredCanvasRenderer", () => {
  it("defers rendering until the next animation frame", () => {
    const scheduler = createFrameScheduler();
    const render = vi.fn();
    const renderer = createDeferredCanvasRenderer(scheduler);
    const element = { isConnected: true } as HTMLElement;

    renderer.schedule({ element, render });

    expect(render).not.toHaveBeenCalled();
    scheduler.runFrame(1);
    expect(render).toHaveBeenCalledOnce();
  });

  it("does not render an element removed before the frame", () => {
    const scheduler = createFrameScheduler();
    const render = vi.fn();
    const renderer = createDeferredCanvasRenderer(scheduler);
    const element = { isConnected: true } as HTMLElement;

    renderer.schedule({ element, render });
    Object.assign(element, { isConnected: false });
    scheduler.runFrame(1);

    expect(render).not.toHaveBeenCalled();
  });

  it("replaces a pending render for the same element", () => {
    const scheduler = createFrameScheduler();
    const firstRender = vi.fn();
    const secondRender = vi.fn();
    const renderer = createDeferredCanvasRenderer(scheduler);
    const element = { isConnected: true } as HTMLElement;

    renderer.schedule({ element, render: firstRender });
    renderer.schedule({ element, render: secondRender });

    expect(scheduler.cancelFrame).toHaveBeenCalledWith(1);
    scheduler.runFrame(1);
    scheduler.runFrame(2);
    expect(firstRender).not.toHaveBeenCalled();
    expect(secondRender).toHaveBeenCalledOnce();
  });

  it("cancels pending renders during cleanup", () => {
    const scheduler = createFrameScheduler();
    const render = vi.fn();
    const renderer = createDeferredCanvasRenderer(scheduler);
    const element = { isConnected: true } as HTMLElement;

    renderer.schedule({ element, render });
    renderer.cancelAll();
    scheduler.runFrame(1);

    expect(scheduler.cancelFrame).toHaveBeenCalledWith(1);
    expect(render).not.toHaveBeenCalled();
  });
});
