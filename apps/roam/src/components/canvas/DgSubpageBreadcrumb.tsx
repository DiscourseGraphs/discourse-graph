// Screen-fixed breadcrumb + back bar for nested sub-pages. Real UI chrome, not
// a drawn shape: registered as the tldraw `HelperButtons` UI component (the
// slot under the page menu, verified visible in 2.4.6), composed with the
// default helper buttons rather than replacing them. Built from tldraw UI
// primitives and theme variables so it matches the host chrome in both themes.
import React from "react";
import {
  DefaultHelperButtons,
  TldrawUiButton,
  TldrawUiButtonIcon,
  TldrawUiButtonLabel,
  TldrawUiIcon,
  useEditor,
  useValue,
} from "tldraw";
import { enterPage, getLineage } from "./nestedPageNavigation";

// Layout-only inline styles; colors, radius, and shadow come from tldraw's
// theme variables.
const barStyle: React.CSSProperties = {
  pointerEvents: "all",
  display: "flex",
  alignItems: "center",
  margin: "6px 0 0 8px",
  padding: "0 2px",
  background: "var(--color-panel)",
  borderRadius: "var(--radius-3)",
  boxShadow: "var(--shadow-2)",
  color: "var(--color-text-1)",
  maxWidth: "70vw",
  overflow: "hidden",
  width: "fit-content",
};

const crumbLabelStyle: React.CSSProperties = {
  maxWidth: 220,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const DgSubpageBreadcrumb = (): React.ReactElement | null => {
  const editor = useEditor();
  const chain = useValue("dg-subpage-breadcrumb", () => getLineage(editor), [
    editor,
  ]);
  // Root page (no dgNested.parentPageId): render nothing.
  if (chain.length <= 1) return null;

  const go = (id: string): void => {
    if (id !== editor.getCurrentPageId()) enterPage(editor, id);
  };
  // pointerdown must not reach canvas hit-testing; activation happens on
  // click so keyboard (Enter/Space) triggers navigation too.
  const stop = (e: React.PointerEvent): void => e.stopPropagation();
  const parent = chain[chain.length - 2];

  return (
    <div style={barStyle}>
      <TldrawUiButton
        type="low"
        title={`Back to ${parent.name}`}
        onPointerDown={stop}
        onClick={() => go(parent.id)}
      >
        <TldrawUiButtonIcon icon="arrow-left" small />
        <TldrawUiButtonLabel>back</TldrawUiButtonLabel>
      </TldrawUiButton>
      {chain.map((page, i) => {
        const isLast = i === chain.length - 1;
        return (
          <React.Fragment key={page.id}>
            {i > 0 ? <TldrawUiIcon icon="chevron-right" small /> : null}
            <TldrawUiButton
              type="low"
              disabled={isLast}
              title={page.name}
              onPointerDown={stop}
              onClick={() => go(page.id)}
            >
              <TldrawUiButtonLabel>
                <span style={crumbLabelStyle}>{page.name}</span>
              </TldrawUiButtonLabel>
            </TldrawUiButton>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// The HelperButtons slot override: keep the default content (back-to-content
// etc.) and add the breadcrumb under it.
export const NestedPageHelperButtons = (): React.ReactElement => (
  <>
    <DefaultHelperButtons />
    <DgSubpageBreadcrumb />
  </>
);
