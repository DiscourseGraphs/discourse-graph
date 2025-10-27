import {
  MIN_NODE_WIDTH,
  MAX_NODE_WIDTH,
} from "~/components/canvas/shapes/nodeConstants";

/**
 * Measure the dimensions needed for a discourse node's text content.
 * This renders the actual DOM structure that appears in the component,
 * matching the Tailwind classes and layout exactly.
 * 
 * Width is dynamic (fit-content) with a max constraint, matching Roam's behavior.
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
  container.style.setProperty("padding", "0.5rem"); // p-2
  container.style.setProperty("border", "2px solid transparent"); // border-2
  container.style.setProperty("border-radius", "0.375rem"); // rounded-md

  // Create title element: <h1 className="m-1 text-base">
  const titleEl = document.createElement("h1");
  titleEl.style.setProperty("margin", "0.25rem"); // m-1
  titleEl.style.setProperty("font-size", "1rem"); // text-base (16px)
  titleEl.style.setProperty("line-height", "1.5");
  titleEl.style.setProperty("font-weight", "600");
  titleEl.textContent = title || "...";
  
  // Create subtitle element: <p className="m-0 text-sm opacity-80">
  const subtitleEl = document.createElement("p");
  subtitleEl.style.setProperty("margin", "0"); // m-0
  subtitleEl.style.setProperty("font-size", "0.875rem"); // text-sm (14px)
  subtitleEl.style.setProperty("line-height", "1.25");
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

