import {
  FONT_SIZES,
  FONT_FAMILIES,
  TLDefaultSizeStyle,
  TLDefaultFontStyle,
} from "tldraw";

/**
 * Measure the dimensions needed for a discourse node's text content.
 * This renders the actual DOM structure that appears in the component,
 * matching the Tailwind classes and layout exactly.
 *
 * Width is dynamic (fit-content) with a max constraint, matching Roam's behavior.
 *
 * IMPORTANT: Layout must match DiscourseNodeShape.tsx.
 * Static layout lives in styles.css (.dg-node-text-measure-*); min/max width
 * must match MIN_NODE_WIDTH / MAX_NODE_WIDTH in nodeConstants.ts.
 *
 * Structure matches DiscourseNodeShape.tsx:
 * - Container: p-2 border-2 rounded-md (box-border flex-col)
 * - Title (h1): m-1 with dynamic fontSize and fontFamily
 */
export const measureNodeText = ({
  title,
  size = "s",
  fontFamily = "draw",
}: {
  title: string;
  size?: TLDefaultSizeStyle;
  fontFamily?: TLDefaultFontStyle;
}): { w: number; h: number } => {
  const fontSize = FONT_SIZES[size];
  const fontFamilyValue = FONT_FAMILIES[fontFamily];
  const container = document.createElement("div");
  container.className = "dg-node-text-measure-container";

  const titleEl = document.createElement("h1");
  titleEl.className = "dg-node-text-measure-title";
  titleEl.setCssProps({
    "--dg-measure-font-size": `${fontSize}px`,
    "--dg-measure-font-family": fontFamilyValue,
  });
  titleEl.textContent = title || "...";

  container.appendChild(titleEl);

  // Append to body, measure, and remove
  document.body.appendChild(container);
  const rect = container.getBoundingClientRect();
  document.body.removeChild(container);

  return {
    w: rect.width,
    h: rect.height,
  };
};
