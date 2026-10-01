import React, { useCallback } from "react";
import { useEditor, useValue, stopEventPropagation, TLShapeId } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { EXTERNAL_LINK_ICON_SVG } from "~/icons";
import {
  getTextShapeLinkUrl,
  isObsidianUrl,
} from "~/components/canvas/utils/textShapeLink";
import {
  parseObsidianOpenUrl,
  resolveObsidianUrlToFile,
} from "~/components/canvas/utils/externalContentHandlers";
import {
  openFileInNewLeaf,
  openFileInNewTab,
  openFileInSidebar,
} from "~/components/canvas/utils/openFileUtils";
import { showToast } from "~/components/canvas/utils/toastUtils";

// The icon lives in CSS; only the per-shape coordinates can be inline.
const ICON_MASK_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  EXTERNAL_LINK_ICON_SVG,
)}")`;

// Matches tldraw's own HyperlinkButton, which hides itself when zoomed out.
const HIDE_BELOW_ZOOM = 0.32;

type TextLink = { id: TLShapeId; url: string; left: number; top: number };

type TextLinkOverlayProps = { plugin: DiscourseGraphPlugin };

// Rendered here, not on a custom shape util, so the stock text shape stays
// untouched -- at the cost of rotation, frame clipping and stacking fidelity.
export const TextLinkOverlay = ({ plugin }: TextLinkOverlayProps) => {
  const editor = useEditor();

  const links = useValue<TextLink[]>(
    "textShapeLinks",
    () => {
      if (editor.getZoomLevel() < HIDE_BELOW_ZOOM) return [];
      return editor.getCurrentPageShapes().flatMap<TextLink>((shape) => {
        if (shape.type !== "text") return [];
        const url = getTextShapeLinkUrl(shape);
        if (!url) return [];
        const bounds = editor.getShapePageBounds(shape.id);
        if (!bounds) return [];
        const topRight = editor.pageToViewport({
          x: bounds.maxX,
          y: bounds.minY,
        });
        const bottomRight = editor.pageToViewport({
          x: bounds.maxX,
          y: bounds.maxY,
        });
        return [
          {
            id: shape.id,
            url,
            left: topRight.x,
            top: (topRight.y + bottomRight.y) / 2,
          },
        ];
      });
    },
    [editor],
  );

  const openLink = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, url: string) => {
      if (!isObsidianUrl(url)) return;
      // Swallow every obsidian: href, parseable or not. Falling through hands
      // the URI to the OS handler, which runs it against the reader's vault.
      event.preventDefault();

      const parsed = parseObsidianOpenUrl(url);
      const file = parsed ? resolveObsidianUrlToFile(plugin, parsed) : null;
      if (!file) {
        showToast({
          severity: "warning",
          title: "Cannot open link",
          description: "The linked file is not in this vault",
        });
        return;
      }

      // Mirrors the discourse-node gestures in TldrawViewComponent.
      const open = event.altKey
        ? openFileInNewLeaf
        : event.metaKey || event.ctrlKey
          ? openFileInNewTab
          : openFileInSidebar;
      void open(plugin.app, file);
      editor.selectNone();
    },
    [editor, plugin],
  );

  // Upstream lets shift-click through so the canvas can still select the shape.
  const stopUnlessShift = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>) => {
      if (!editor.inputs.shiftKey) stopEventPropagation(event);
    },
    [editor],
  );

  return (
    <div
      className="dg-text-link-overlay"
      style={
        { "--dg-external-link-icon": ICON_MASK_URL } as React.CSSProperties
      }
    >
      {links.map(({ id, url, left, top }) => (
        <a
          key={id}
          className="tl-hyperlink-button"
          style={{ left: `${left}px`, top: `${top}px` }}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => openLink(event, url)}
          onPointerDown={stopUnlessShift}
          onPointerUp={stopUnlessShift}
          title={url}
          draggable={false}
        >
          <div className="tl-hyperlink__icon" />
        </a>
      ))}
    </div>
  );
};
