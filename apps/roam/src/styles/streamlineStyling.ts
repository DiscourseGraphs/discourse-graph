export default /* css */ `
/* 1) Page links: gray text with an underline simulated via bottom border */
.rm-page-ref {
  color: #666;
  border-bottom: 3px solid #ddd;
  text-decoration: none;
}
.rm-page-ref:hover {
  color: #666;
  border-bottom-color: #ddd;
  text-decoration: none;
}

/* 2) Todo boxes: gray */
.check-container .checkmark {
  background: transparent;
  border: 2px solid #bbb;
  border-radius: 3px;
}
.check-container input:checked ~ .checkmark {
  background: #eee;
  border-color: #aaa;
}
/* Checkmark tick color (optional) */
.check-container .checkmark:after {
  border-right: 2px solid #333;
  border-bottom: 2px solid #333;
}

/* 3) Right sidebar: white background */
#right-sidebar {
  background-color: white;
}

.roam-main {
  border: 1px solid rgba(171, 171, 171, 0.5) ;
}

/* 4) Tables: no row/body background */
table.bp3-html-table.bp3-html-table-striped tbody tr:nth-child(odd) td {
  background: transparent;
}
table.bp3-html-table.bp3-html-table-striped tbody tr:nth-child(even) td {
  background: transparent;
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

