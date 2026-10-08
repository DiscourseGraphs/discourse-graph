import { TLUiToast } from "tldraw";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";
import generateUid from "~/utils/generateUid";

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
    // tldraw replaces a toast with the same id, so toasts shown together need unique ids
    id: generateUid(severity),
    title,
    description,
    severity,
    keepOpen: false,
  };
  dispatchToastEvent(toast, targetCanvasId);
};
