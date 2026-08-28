type FrameCallback = () => void;

type DeferredCanvasRenderer = {
  schedule: (args: { element: HTMLElement; render: () => void }) => void;
  cancelAll: () => void;
};

export const createDeferredCanvasRenderer = ({
  requestFrame = window.requestAnimationFrame.bind(window),
  cancelFrame = window.cancelAnimationFrame.bind(window),
}: {
  requestFrame?: (callback: FrameCallback) => number;
  cancelFrame?: (frameId: number) => void;
} = {}): DeferredCanvasRenderer => {
  const pendingFrames = new Map<HTMLElement, number>();

  const schedule = ({
    element,
    render,
  }: {
    element: HTMLElement;
    render: () => void;
  }): void => {
    const pendingFrame = pendingFrames.get(element);
    if (pendingFrame !== undefined) cancelFrame(pendingFrame);

    const frameId = requestFrame(() => {
      pendingFrames.delete(element);
      if (!element.isConnected) return;

      render();
    });
    pendingFrames.set(element, frameId);
  };

  const cancelAll = (): void => {
    pendingFrames.forEach((frameId) => cancelFrame(frameId));
    pendingFrames.clear();
  };

  return { schedule, cancelAll };
};
