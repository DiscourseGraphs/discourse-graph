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

/* Discourse Graph ToolButton */
 button[data-value="discourse-tool"] div::before {
  content: "";
  display: inline-block;
  width: 18px;
  height: 18px;
  background-image: url("data:image/svg+xml,%3Csvg width='256' height='264' viewBox='0 0 256 264' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M156.705 252.012C140.72 267.995 114.803 267.995 98.8183 252.012L11.9887 165.182C-3.99622 149.197 -3.99622 123.28 11.9886 107.296L55.4035 63.8807C63.3959 55.8881 76.3541 55.8881 84.3467 63.8807C92.3391 71.8731 92.3391 84.8313 84.3467 92.8239L69.8751 107.296C53.8901 123.28 53.8901 149.197 69.8751 165.182L113.29 208.596C121.282 216.589 134.241 216.589 142.233 208.596C150.225 200.604 150.225 187.646 142.233 179.653L127.761 165.182C111.777 149.197 111.777 123.28 127.761 107.296C143.746 91.3105 143.746 65.3939 127.761 49.4091L113.29 34.9375C105.297 26.9452 105.297 13.9868 113.29 5.99432C121.282 -1.99811 134.241 -1.99811 142.233 5.99434L243.533 107.296C259.519 123.28 259.519 149.197 243.533 165.182L156.705 252.012ZM200.119 121.767C192.127 113.775 179.168 113.775 171.176 121.767C163.184 129.76 163.184 142.718 171.176 150.71C179.168 158.703 192.127 158.703 200.119 150.71C208.112 142.718 208.112 129.76 200.119 121.767Z' fill='%23000000'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
}

/* Maximize Tldraw Canvas */
/* Used in conjunction with tailwind classes on the canvas container */
.roam-body .roam-app .roam-main .roam-article.dg-tldraw-maximized,
.roam-body .roam-app .roam-main .rm-sidebar-outline.dg-tldraw-maximized {
  position: static;
}
`;
