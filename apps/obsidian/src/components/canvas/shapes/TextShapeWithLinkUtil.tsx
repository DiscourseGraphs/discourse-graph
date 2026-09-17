import React, { useCallback } from "react";
import {
  TextShapeUtil,
  TLTextShape,
  stopEventPropagation,
  textShapeProps,
  useEditor,
  useValue,
} from "tldraw";
import { EXTERNAL_LINK_ICON_SVG } from "~/icons";
import { usePlugin } from "~/components/PluginContext";
import { textLinkUrl } from "~/components/canvas/utils/textShapeLink";
import {
  parseObsidianOpenUrl,
  resolveObsidianUrlToFile,
} from "~/components/canvas/utils/externalContentHandlers";
import { openFileInSidebar } from "~/components/canvas/utils/openFileUtils";
import { showToast } from "~/components/canvas/utils/toastUtils";

export type TextShapeWithLinkProps = TLTextShape["props"] & { url: string };

export const getTextShapeUrl = (shape: TLTextShape): string =>
  (shape.props as Partial<TextShapeWithLinkProps>).url ?? "";

const LINK_ICON_MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  EXTERNAL_LINK_ICON_SVG,
)}") center 100% / 100% no-repeat`;

const isObsidianUrl = (url: string): boolean =>
  url.toLowerCase().startsWith("obsidian:");

// tldraw does not export HyperlinkButton, so this mirrors its markup to keep
// text links visually identical to geo links.
const HyperlinkButton = ({ url }: { url: string }): React.ReactElement => {
  const editor = useEditor();
  const plugin = usePlugin();
  const isHidden = useValue("zoomLevel", () => editor.getZoomLevel() < 0.32, [
    editor,
  ]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isObsidianUrl(url)) return;
      // Always swallow obsidian: hrefs. Falling through hands the URI to the OS
      // handler, which runs it against the reader's vault.
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
      void openFileInSidebar(plugin.app, file);
    },
    [plugin, url],
  );

  // Upstream lets shift-click through so the canvas can still select the shape.
  const stopUnlessShift = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>) => {
      if (!editor.inputs.shiftKey) stopEventPropagation(event);
    },
    [editor],
  );

  return (
    <a
      className={[
        "tl-hyperlink-button",
        "dg-text-hyperlink-button",
        isHidden && "tl-hyperlink-button__hidden",
      ]
        .filter(Boolean)
        .join(" ")}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onPointerDown={stopUnlessShift}
      onPointerUp={stopUnlessShift}
      title={url}
      draggable={false}
    >
      <div
        className="tl-hyperlink__icon"
        style={{ mask: LINK_ICON_MASK, WebkitMask: LINK_ICON_MASK }}
      />
    </a>
  );
};

const textShapeWithLinkProps = { ...textShapeProps, url: textLinkUrl };

// Adds the `url` prop that tldraw's built-in Edit link action gates on
// (`'url' in shape.props`), so text shapes reuse the geo link UI unchanged.
export class TextShapeWithLinkUtil extends TextShapeUtil {
  static override props = textShapeWithLinkProps;

  // `static props` alone gives no default, so every createShape({type:"text"})
  // would fail validation on the missing url.
  override getDefaultProps(): TextShapeWithLinkProps {
    return { ...super.getDefaultProps(), url: "" };
  }

  override component(
    shape: TLTextShape,
  ): ReturnType<TextShapeUtil["component"]> {
    const url = getTextShapeUrl(shape);
    return (
      <>
        {super.component(shape)}
        {url && <HyperlinkButton url={url} />}
      </>
    );
  }
}
