import React, { useCallback } from "react";
import {
  TextShapeUtil,
  TLTextShape,
  stopEventPropagation,
  textShapeProps,
} from "tldraw";
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

// tldraw does not export HyperlinkButton, so this mirrors its markup to keep
// text links visually identical to geo links.
const HyperlinkButton = ({
  url,
  zoomLevel,
}: {
  url: string;
  zoomLevel: number;
}): React.ReactElement => {
  const plugin = usePlugin();

  // Opening obsidian:// in-app avoids an OS protocol round trip that would
  // defocus and re-enter Obsidian.
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      const parsed = parseObsidianOpenUrl(url);
      if (!parsed) return;
      event.preventDefault();

      const file = resolveObsidianUrlToFile(plugin, parsed);
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

  return (
    <a
      className={`tl-hyperlink-button${
        zoomLevel < 0.32 ? "tl-hyperlink-button__hidden" : ""
      }`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onPointerDown={stopEventPropagation}
      onPointerUp={stopEventPropagation}
      title={url}
      draggable={false}
    >
      <div className="tl-hyperlink__icon dg-hyperlink__icon" />
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
        {url && (
          <HyperlinkButton url={url} zoomLevel={this.editor.getZoomLevel()} />
        )}
      </>
    );
  }
}
