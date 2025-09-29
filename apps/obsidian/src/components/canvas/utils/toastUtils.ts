import { TLUiToast } from "tldraw";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";

export const showToast = ({
  severity,
  title,
  description,
}: {
  severity: TLUiToast["severity"];
  title: string;
  description?: string;
}) => {
  const toast: TLUiToast = {
    id: `${severity}-${Date.now()}`,
    title,
    description,
    severity,
    keepOpen: false,
  };
  dispatchToastEvent(toast);
};