import { TLUiToast } from "tldraw";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";

export const showToast = ({
  severity,
  title,
  description,
  targetCanvasId,
}: {
  severity: TLUiToast["severity"];
  title: string;
  description?: string;
  targetCanvasId?: string;
}) => {
  const toast: TLUiToast = {
    id: `${severity}-${Date.now()}`,
    title,
    description,
    severity,
    keepOpen: false,
  };
  dispatchToastEvent(toast, targetCanvasId);
};