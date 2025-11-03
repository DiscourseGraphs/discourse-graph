import {
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
  CONTAINER_PADDING,
  CONTAINER_BORDER_WIDTH,
  CONTAINER_BORDER_RADIUS,
  TITLE_MARGIN,
  TITLE_FONT_SIZE,
  TITLE_LINE_HEIGHT,
  TITLE_FONT_WEIGHT,
  SUBTITLE_MARGIN,
  SUBTITLE_FONT_SIZE,
  SUBTITLE_LINE_HEIGHT,
} from "~/components/canvas/shapes/nodeConstants";

/**
 * Measure the dimensions needed for a discourse node's text content.
 * This renders the actual DOM structure that appears in the component,
 * matching the Tailwind classes and layout exactly.
 *
 * Width is dynamic (fit-content) with a max constraint, matching Roam's behavior.
 *
 * IMPORTANT: The styles used here must match DiscourseNodeShape.tsx.
 * If you change styles in nodeConstants.ts, both this function and the component
 * will automatically stay in sync.
 *
 * Structure matches DiscourseNodeShape.tsx:
 * - Container: p-2 border-2 rounded-md (box-border flex-col)
 * - Title (h1): m-1 text-base
 * - Subtitle (p): m-0 text-sm
 */
export const measureNodeText = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): { w: number; h: number } => {
  // Create a container matching the actual component structure
  const container = document.createElement("div");
  container.style.setProperty("position", "absolute");
  container.style.setProperty("visibility", "hidden");
  container.style.setProperty("pointer-events", "none");

  // Match the actual component classes and styles
  // className="box-border flex h-full w-full flex-col items-start justify-start rounded-md border-2 p-2"
  container.style.setProperty("box-sizing", "border-box");
  container.style.setProperty("display", "flex");
  container.style.setProperty("flex-direction", "column");
  container.style.setProperty("align-items", "flex-start");
  container.style.setProperty("justify-content", "flex-start");
  // Dynamic width with constraints - matches Roam's approach
  container.style.setProperty("width", "fit-content");
  container.style.setProperty("min-width", `${MIN_NODE_WIDTH}px`);
  container.style.setProperty("max-width", `${MAX_NODE_WIDTH}px`);
  container.style.setProperty("padding", CONTAINER_PADDING as string);
  container.style.setProperty(
    "border",
    `${CONTAINER_BORDER_WIDTH} solid transparent`,
  );
  container.style.setProperty(
    "border-radius",
    CONTAINER_BORDER_RADIUS as string,
  );

  // Create title element: <h1 className="m-1 text-base">
  const titleEl = document.createElement("h1");
  titleEl.style.setProperty("margin", TITLE_MARGIN as string);
  titleEl.style.setProperty("font-size", TITLE_FONT_SIZE as string);
  titleEl.style.setProperty("line-height", String(TITLE_LINE_HEIGHT));
  titleEl.style.setProperty("font-weight", TITLE_FONT_WEIGHT as string);
  titleEl.textContent = title || "...";

  // Create subtitle element: <p className="m-0 text-sm opacity-80">
  const subtitleEl = document.createElement("p");
  subtitleEl.style.setProperty("margin", SUBTITLE_MARGIN as string);
  subtitleEl.style.setProperty("font-size", SUBTITLE_FONT_SIZE as string);
  subtitleEl.style.setProperty("line-height", String(SUBTITLE_LINE_HEIGHT));
  subtitleEl.textContent = subtitle || "";

  container.appendChild(titleEl);
  container.appendChild(subtitleEl);

  // Append to body, measure, and remove
  document.body.appendChild(container);
  const rect = container.getBoundingClientRect();
  document.body.removeChild(container);

  return {
    w: rect.width,
    h: rect.height,
  };
};

