// tldrawStyles.ts because some of these styles need to be inlined
export default /* css */ `
  /* Hide Roam Blocks only when a full-page canvas is present (not embedded) */
  .roam-article:has(.roamjs-tldraw-canvas-container:not(.dg-canvas-embed *)) .rm-block-children  {
    display: none;
  }

  /* Hide Roam Blocks in sidebar when a full-page canvas is present (not embedded) */
  .rm-sidebar-outline:has(.roamjs-tldraw-canvas-container:not(.dg-canvas-embed *)) .rm-block-children {
    display: none;
  }
  
  /* Shape Render Fix */
  svg.tl-svg-container {
    overflow: visible;
  }
  
  /* CANVAS */
  /* fixes drawing arrows in north-west direction */
  /* and selection context not being shown */
  .roamjs-tldraw-canvas-container svg {
    overflow: visible;
  }
  
  /* Roam's font-family is hijacking tldraw's */
  .tl-text-wrapper[data-font="draw"] div {
    font-family: var(--tl-font-draw);
  }
  .tl-text-wrapper[data-font="sans"] div {
    font-family: var(--tl-font-sans);
  }
  .tl-text-wrapper[data-font="serif"] div {
    font-family: var(--tl-font-serif);
  }
  .tl-text-wrapper[data-font="mono"] div {
    font-family: var(--tl-font-mono);
  }
  
  /* .tl-arrow-label__inner {
    min-width: initial;
  } */

  /* Keyboard Shortcuts */
  kbd.tlui-kbd {
    background-color: initial;
    box-shadow: initial;
    border-radius: initial;
    padding: initial;
  }
  
  /* .roamjs-tldraw-canvas-container
    .tl-shape
    .roamjs-tldraw-node
    .rm-block-main
    .rm-block-separator {
    display: none;
  } */
  /* arrow label line fix */
  /* seems like width is being miscalculted cause letters to linebreak */
  /* TODO: this is a temporary fix */
  /* also Roam is hijacking the font choice */
  /* .tl-arrow-label .tl-arrow-label__inner p {
    padding: 0;
    white-space: nowrap;
    font-family: "Inter", sans-serif;
  } */



/* Maximize Tldraw Canvas */
/* Used in conjunction with tailwind classes on the canvas container */
.roam-body .roam-app .roam-main .roam-article.dg-tldraw-maximized,
.roam-body .roam-app .roam-main .rm-sidebar-outline.dg-tldraw-maximized {
  position: static;
}

.dg-tiny-hand-surface {
  position: absolute;
  inset: 0;
  z-index: calc(var(--layer-canvas-blocker) + 1);
  overflow: hidden;
  cursor: none;
  touch-action: none;
  pointer-events: auto;
  user-select: none;
}

.dg-tiny-hand-surface svg {
  display: block;
  pointer-events: none;
}

.dg-tiny-hand-pointer {
  filter: drop-shadow(1px 2px 2px #0005);
}

.dg-tiny-hand-controls {
  position: absolute;
  z-index: calc(var(--layer-panels) - 1);
  left: 50%;
  top: 44px;
  transform: translateX(-50%);
  display: flex;
  width: max-content;
  max-width: calc(100% - 12px);
  flex-wrap: wrap;
  justify-content: center;
  border-radius: var(--radius-2);
  background: var(--color-panel);
  box-shadow: var(--shadow-2);
  pointer-events: auto;
}

.dg-tiny-hand-controls button {
  height: 32px;
  padding: 0 8px;
}

.dg-tiny-hand-controls button[aria-pressed="true"] {
  color: var(--color-selected);
}

.dg-tiny-hand-tap {
  animation: dg-tiny-hand-tap 450ms ease-out both;
}

@keyframes dg-tiny-hand-tap {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Clipboard toggle button in toolbar */
.tlui-toolbar__lock-button[data-clipboard-open="true"]::after {
  background-color: var(--color-muted-2);
  opacity: 1;
}

/* Widen the style panel when it shows the node card Context/Styling tabs */
.tlui-style-panel:has(.dg-node-style-panel) {
  width: 280px;
  max-width: 280px;
}

.dg-node-style-panel .bp3-tab-list {
  justify-content: center;
}
`;
