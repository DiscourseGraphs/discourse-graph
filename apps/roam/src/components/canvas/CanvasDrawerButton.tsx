import React from "react";
import { Button, Icon } from "@blueprintjs/core";
import { openCanvasDrawer } from "./CanvasDrawer";

const CanvasDrawerButton = () => {
  return (
    <div
      className="pointer-events-auto absolute top-11 m-2 rounded-lg"
      style={{
        zIndex: 250,
        // copying tldraw var(--shadow-2)
        boxShadow:
          "0px 0px 2px hsl(0, 0%, 0%, 16%), 0px 2px 3px hsl(0, 0%, 0%, 24%), 0px 2px 6px hsl(0, 0%, 0%, 0.1), inset 0px 0px 0px 1px hsl(0, 0%, 100%)",
        backgroundColor: "white",
      }}
    >
      <Button
        icon={<Icon icon="add-column-left" />}
        onClick={openCanvasDrawer}
        minimal
        title="Toggle Canvas Drawer"
      />
    </div>
  );
};

export default CanvasDrawerButton;
