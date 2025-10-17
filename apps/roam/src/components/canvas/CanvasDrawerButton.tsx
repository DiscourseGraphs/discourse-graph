import React from "react";
import { Button, Icon } from "@blueprintjs/core";
import { openCanvasDrawer } from "./CanvasDrawer";

const CanvasDrawerButton = () => {
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

export default CanvasDrawerButton;
