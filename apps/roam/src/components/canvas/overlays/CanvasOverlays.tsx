import React from "react";
import { DragHandleOverlay } from "./DragHandleOverlay";
import { ImageConvertOverlay } from "./ImageConvertOverlay";

export const CanvasOverlays = (): JSX.Element => (
  <>
    <DragHandleOverlay />
    <ImageConvertOverlay />
  </>
);
