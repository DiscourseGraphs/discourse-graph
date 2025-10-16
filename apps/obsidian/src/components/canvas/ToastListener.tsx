import { useEffect } from "react";
import { useToasts, TLUiToast } from "tldraw";

export type ScopedToastEvent = TLUiToast & {
  targetCanvasId?: string;
};

export const dispatchToastEvent = (
  toast: TLUiToast,
  targetCanvasId?: string,
) => {
  const scopedToast: ScopedToastEvent = {
    ...toast,
    targetCanvasId,
  };
  document.dispatchEvent(
    new CustomEvent<ScopedToastEvent>("show-toast", { detail: scopedToast }),
  );
};

type ToastListenerProps = {
  canvasId: string;
};

const ToastListener = ({ canvasId }: ToastListenerProps) => {
  const toasts = useToasts();

  useEffect(() => {
    const handleToastEvent = ((event: CustomEvent<ScopedToastEvent>) => {
      const { targetCanvasId, ...toast } = event.detail;

      if (targetCanvasId && targetCanvasId !== canvasId) {
        return;
      }

      toasts.addToast(toast);
    }) as EventListener;

    document.addEventListener("show-toast", handleToastEvent);

    return () => {
      document.removeEventListener("show-toast", handleToastEvent);
    };
  }, [toasts, canvasId]);

  return null;
};

export default ToastListener;
