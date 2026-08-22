// Screen-fixed breadcrumb + back bar for nested sub-pages. Real UI chrome, not
// a drawn shape: registered as the tldraw `HelperButtons` UI component (the
// slot under the page menu, verified visible in 2.4.6), composed with the
// default helper buttons rather than replacing them.
import React from "react";
import { DefaultHelperButtons, useEditor, useValue } from "tldraw";
import { enterPage, getLineage } from "./nestedPageNavigation";

const DgSubpageBreadcrumb = () => {
  const editor = useEditor();
  const chain = useValue("dg-subpage-breadcrumb", () => getLineage(editor), [
    editor,
  ]);
  // Root page (no dgNested.parentPageId): render nothing.
  if (chain.length <= 1) return null;

  const go = (id: string) => {
    if (id !== editor.getCurrentPageId()) enterPage(editor, id);
  };
  const parent = chain[chain.length - 2];

  return (
    <div
      style={{
        pointerEvents: "all",
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: "6px 0 0 8px",
        padding: "5px 10px",
        background: "rgba(255,255,255,0.94)",
        border: "1px solid #e3e5e9",
        borderRadius: 9,
        boxShadow: "0 1px 6px rgba(20,20,40,0.10)",
        font: "13px var(--tl-font-sans, Inter, system-ui, sans-serif)",
        backdropFilter: "blur(6px)",
        maxWidth: "70vw",
        overflow: "hidden",
        width: "fit-content",
      }}
    >
      <button
        title={`Back to ${parent.name}`}
        onPointerDown={(e) => {
          e.stopPropagation();
          go(parent.id);
        }}
        style={{
          border: "1px solid #dfe1e6",
          background: "#f7f8fa",
          borderRadius: 7,
          padding: "3px 9px",
          cursor: "pointer",
          font: "inherit",
          fontWeight: 600,
          color: "#3a3d42",
          whiteSpace: "nowrap",
        }}
      >
        ⬅ back
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "nowrap",
          overflow: "hidden",
        }}
      >
        {chain.map((page, i) => {
          const isLast = i === chain.length - 1;
          return (
            <span
              key={page.id}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {i > 0 ? <span style={{ color: "#b9bdc4" }}>▸</span> : null}
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (!isLast) go(page.id);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "2px 4px",
                  font: "inherit",
                  cursor: isLast ? "default" : "pointer",
                  color: isLast ? "#1d1d1f" : "#5b6bd6",
                  fontWeight: isLast ? 600 : 500,
                  maxWidth: 220,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {page.name}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
};

// The HelperButtons slot override: keep the default content (back-to-content
// etc.) and add the breadcrumb under it.
export const NestedPageHelperButtons = () => (
  <>
    <DefaultHelperButtons />
    <DgSubpageBreadcrumb />
  </>
);
