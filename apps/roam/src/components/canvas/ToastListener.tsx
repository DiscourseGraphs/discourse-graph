import { useEffect } from "react";
import { useToasts, TLUiToast } from "tldraw";
import { Button, Icon } from "@blueprintjs/core";
import { openCanvasDrawer } from "./CanvasDrawer";

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

  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        zIndex: 1000,
        pointerEvents: "all",
      }}
    >
      <Button
        icon={<Icon icon="add-column-left" />}
        onClick={openCanvasDrawer}
        minimal
        title="Open Canvas Drawer"
      />
    </div>
  );
};

export default ToastListener;
