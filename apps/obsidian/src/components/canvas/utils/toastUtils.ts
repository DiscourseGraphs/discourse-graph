import { TLUiToast } from "tldraw";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";

export const showSuccessToast = (title: string, description?: string) => {
  const toast: TLUiToast = {
    id: `success-${Date.now()}`,
    title,
    description,
    severity: "success",
    keepOpen: false,
  };
  dispatchToastEvent(toast);
};

export const showErrorToast = (title: string, description?: string) => {
  const toast: TLUiToast = {
    id: `error-${Date.now()}`,
    title,
    description,
    severity: "error",
    keepOpen: false,
  };
  dispatchToastEvent(toast);
};

export const showWarningToast = (title: string, description?: string) => {
  const toast: TLUiToast = {
    id: `warning-${Date.now()}`,
    title,
    description,
    severity: "warning",
    keepOpen: false,
  };
  dispatchToastEvent(toast);
};

export const showInfoToast = (title: string, description?: string) => {
  const toast: TLUiToast = {
    id: `info-${Date.now()}`,
    title,
    description,
    severity: "info",
    keepOpen: false,
  };
  dispatchToastEvent(toast);
};
