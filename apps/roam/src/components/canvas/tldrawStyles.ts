// tldrawStyles.ts because some of these styles need to be inlined
export default `
  /* Hide Roam Blocks */
  .roam-article .rm-block-children {
    display: none;
  }
  
  /* Shape Render Fix */
  svg.tl-svg-container {
    overflow: visible;
  }
  
  /* CANVAS */
  /* fixes drawing arrows in north-west direction */
  /* and selection context not being shown */
  #roamjs-tldraw-canvas-container svg {
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
  
  /* #roamjs-tldraw-canvas-container
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
`;
