export default /* css */ `
/* custom controls */

.rm-page-ref {
  color: grey;
}
.rm-checkbox {
  color: grey;
  text-color: grey;
}

.check-container input:checked~.checkmark {
  background-color: grey;
}

#right-sidebar {
  background-color: white;
}

.roam-main {
  border: 1px solid rgba(171, 171, 171, 0.5) ;
}

table.bp3-html-table.bp3-html-table-striped tbody tr:not(:last-child) td {
  background-color: transparent;
  line-height: 1.5rem;
  border-bottom: 1px solid rgba(171, 171, 171, 0.5) ;
}


/* Subtle Controls */

.rm-block .rm-bullet {
  opacity: 0.2;
  transition: opacity 120ms ease;
}

.rm-block:hover > .rm-block-main > .controls > .rm-bullet,
.rm-focused > .rm-block-main > .controls > .rm-bullet {
  opacity: 1;
}

/* optional: change focused bullet inner color, using fallback if var not defined */
.rm-focused > .rm-block-main > .controls > .rm-bullet > .bp3-popover-wrapper .rm-bullet__inner {
  background-color: var(--accent-color, #9E2B0E);
}

.rm-block .rm-multibar {
  opacity: 0.2;
  transition: opacity 120ms ease;
}

.rm-block:hover > .rm-block-children > .rm-multibar,
.rm-focused > .rm-block-children > .rm-multibar {
  opacity: 1;
}

/* caret in reference page view */
.rm-ref-page-view .rm-title-arrow-wrapper > .rm-caret {
  opacity: 0.2;
  transition: opacity 120ms ease;
}

.rm-ref-page-view:hover .rm-title-arrow-wrapper > .rm-caret {
  opacity: 1;
}

`;

