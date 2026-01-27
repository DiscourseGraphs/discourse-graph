/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable preferArrows/prefer-arrow-functions */

import {
  VecLike,
  TLTextShape,
  TLTextShapeProps,
  createShapeId,
  Editor,
  FONT_FAMILIES,
  TEXT_PROPS,
} from "tldraw";
import { FONT_SIZES } from "./DiscourseNodeUtil";
// TODO: replace this whole file with with defaultHandleExternalTextContent() in v3.10.0
// https://tldraw.dev/examples/external-content-sources

// copied from packages\tldraw\src\lib\shapes\shared\TextHelpers.ts
const INDENT = "  ";
function replaceTabsWithSpaces(text: string) {
  return text.replace(/\t/g, INDENT);
}
const rtlRegex =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
function isRightToLeftLanguage(text: string) {
  return rtlRegex.test(text);
}
function stripTrailingWhitespace(text: string): string {
  return text.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
}
function stripCommonMinimumIndentation(text: string): string {
  // Split the text into individual lines
  const lines = text.split("\n");

  // remove any leading lines that are only whitespace or newlines
  while (lines[0] && lines[0].trim().length === 0) {
    lines.shift();
  }

  let minIndentation = Infinity;
  for (const line of lines) {
    if (line.trim().length > 0) {
      const indentation = line.length - line.trimStart().length;
      minIndentation = Math.min(minIndentation, indentation);
    }
  }

  return lines.map((line) => line.slice(minIndentation)).join("\n");
}

function cleanupText(text: string) {
  return stripTrailingWhitespace(
    stripCommonMinimumIndentation(replaceTabsWithSpaces(text)),
  );
}
// copied from packages\tldraw\src\lib\defaultExternalContentHandlers.ts
export const defaultHandleExternalTextContent = async ({
  point,
  text,
  editor,
}: {
  point?: VecLike;
  text: string;
  editor: Editor;
}) => {
  const p =
    point ??
    (editor.inputs.shiftKey
      ? editor.inputs.currentPagePoint
      : editor.getViewportPageBounds().center);

  const defaultProps = editor
    .getShapeUtil<TLTextShape>("text")
    .getDefaultProps();

  const textToPaste = cleanupText(text);

  // If we're pasting into a text shape, update the text.
  const onlySelectedShape = editor.getOnlySelectedShape();
  if (onlySelectedShape && "text" in onlySelectedShape.props) {
    editor.updateShapes([
      {
        id: onlySelectedShape.id,
        type: onlySelectedShape.type,
        props: {
          text: textToPaste,
        },
      },
    ]);

    return;
  }

  // Measure the text with default values
  let w: number;
  let h: number;
  let autoSize: boolean;
  let align = "middle" as TLTextShapeProps["textAlign"];

  const isMultiLine = textToPaste.split("\n").length > 1;

  // check whether the text contains the most common characters in RTL languages
  const isRtl = isRightToLeftLanguage(textToPaste);

  if (isMultiLine) {
    align = isMultiLine ? (isRtl ? "end" : "start") : "middle";
  }

  const rawSize = editor.textMeasure.measureText(textToPaste, {
    ...TEXT_PROPS,
    fontFamily: FONT_FAMILIES[defaultProps.font],
    fontSize: FONT_SIZES[defaultProps.size],
    maxWidth: null,
  });

  const minWidth = Math.min(
    isMultiLine ? editor.getViewportPageBounds().width * 0.9 : 920,
    Math.max(200, editor.getViewportPageBounds().width * 0.9),
  );

  if (rawSize.w > minWidth) {
    const shrunkSize = editor.textMeasure.measureText(textToPaste, {
      ...TEXT_PROPS,
      fontFamily: FONT_FAMILIES[defaultProps.font],
      fontSize: FONT_SIZES[defaultProps.size],
      maxWidth: minWidth,
    });
    w = shrunkSize.w;
    h = shrunkSize.h;
    autoSize = false;
    align = isRtl ? "end" : "start";
  } else {
    // autosize is fine
    w = rawSize.w;
    h = rawSize.h;
    autoSize = true;
  }

  if (p.y - h / 2 < editor.getViewportPageBounds().minY + 40) {
    p.y = editor.getViewportPageBounds().minY + 40 + h / 2;
  }

  editor.createShapes<TLTextShape>([
    {
      id: createShapeId(),
      type: "text",
      x: p.x - w / 2,
      y: p.y - h / 2,
      props: {
        text: textToPaste,
        // if the text has more than one line, align it to the left
        textAlign: align,
        autoSize,
        w,
      },
    },
  ]);
};
