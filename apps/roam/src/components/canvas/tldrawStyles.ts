// tldrawStyles.ts because some of these styles need to be inlined
export default /* css */ `
  /* Hide Roam Blocks only when a canvas is present under the root */
  .roam-article:has(.roamjs-tldraw-canvas-container) .rm-block-children  {
    display: none;
  }
  
  /* Hide Roam Blocks in sidebar when a canvas is present */
  .rm-sidebar-outline:has(.roamjs-tldraw-canvas-container) .rm-block-children {
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

/* Clipboard toggle button in toolbar */
.tlui-toolbar__lock-button[data-clipboard-open="true"]::after {
  background-color: var(--color-muted-2);
  opacity: 1;
}
`;
