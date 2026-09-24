import React from "react";
import {
  T,
  TextShapeUtil,
  TLTextShape,
  stopEventPropagation,
  textShapeProps,
} from "tldraw";

export type TextShapeWithLinkProps = TLTextShape["props"] & { url: string };

const LINK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' fill='none'%3E%3Cpath stroke='%23000' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 5H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6M19 5h6m0 0v6m0-6L13 17'/%3E%3C/svg%3E";

// tldraw does not export HyperlinkButton, so this mirrors its markup to keep
// text links visually identical to geo links.
const HyperlinkButton = ({
  url,
  zoomLevel,
}: {
  url: string;
  zoomLevel: number;
}): JSX.Element => (
  <a
    className={[
      "tl-hyperlink-button",
      "dg-text-link-button",
      zoomLevel < 0.32 ? "tl-hyperlink-button__hidden" : "",
    ]
      .filter(Boolean)
      .join(" ")}
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    onPointerDown={stopEventPropagation}
    onPointerUp={stopEventPropagation}
    title={url}
    draggable={false}
  >
    <div
      className="tl-hyperlink__icon"
      style={{
        mask: `url("${LINK_ICON}") center 100% / 100% no-repeat`,
        WebkitMask: `url("${LINK_ICON}") center 100% / 100% no-repeat`,
      }}
    />
  </a>
);

export const getTextShapeUrl = (shape: TLTextShape): string =>
  (shape.props as Partial<TextShapeWithLinkProps>).url ?? "";

const textShapeWithLinkProps = { ...textShapeProps, url: T.linkUrl };

// Adds the `url` prop that tldraw's built-in Edit link action gates on
// (`'url' in shape.props`), so text shapes reuse the geo link UI unchanged.
export class TextShapeWithLinkUtil extends TextShapeUtil {
  static override props = textShapeWithLinkProps;

  override getDefaultProps(): TextShapeWithLinkProps {
    return { ...super.getDefaultProps(), url: "" };
  }

  // The cast bridges two React type copies in the dependency tree, which make
  // the base signature's JSX.Element nominally distinct from ours.
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
    ) as ReturnType<TextShapeUtil["component"]>;
  }
}
