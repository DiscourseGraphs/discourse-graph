import { useEffect } from "react";
import { useToasts, TLUiToast } from "tldraw";

export const dispatchToastEvent = (toast: TLUiToast) => {
  document.dispatchEvent(
    new CustomEvent<TLUiToast>("show-toast", { detail: toast }),
  );
};

const ToastListener = () => {
  const { addToast } = useToasts();

  useEffect(() => {
    const handleToastEvent = ((event: CustomEvent<TLUiToast>) => {
      const {
        id,
        icon,
        title,
        description,
        actions,
        keepOpen,
        closeLabel,
        severity,
      } = event.detail;
      addToast({
        id,
        icon,
        title,
        description,
        actions,
        keepOpen,
        closeLabel,
        severity,
      });
    }) as EventListener;

    document.addEventListener("show-toast", handleToastEvent);

    return () => {
      document.removeEventListener("show-toast", handleToastEvent);
    };
  }, [addToast]);

  return null;
};

export default ToastListener;
