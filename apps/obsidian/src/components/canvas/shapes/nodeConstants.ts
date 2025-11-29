/**
 * Constants for Discourse Node styling and sizing.
 * These values match the Tailwind classes used in DiscourseNodeShape component.
 * 
 * IMPORTANT: If you change these values, you must also update:
 * - The Tailwind classes in DiscourseNodeShape.tsx (line ~263)
 * - The measurement function in measureNodeText.ts
 */

export const DEFAULT_NODE_WIDTH = 200;
export const MIN_NODE_WIDTH = 160;
export const MAX_NODE_WIDTH = 400;

// Container styles (matches: p-2 border-2 rounded-md)
export const CONTAINER_PADDING = "0.5rem"; // p-2 = 0.5rem = 8px
export const CONTAINER_BORDER_WIDTH = "2px"; // border-2
export const CONTAINER_BORDER_RADIUS = "0.375rem"; // rounded-md = 6px

// Title styles (matches: m-1 text-base)
export const TITLE_MARGIN = "0.25rem"; // m-1 = 0.25rem = 4px
export const TITLE_FONT_SIZE = "1rem"; // text-base = 1rem = 16px
export const TITLE_LINE_HEIGHT = 1.5;
export const TITLE_FONT_WEIGHT = "600"; // font-semibold

// Subtitle styles (matches: m-0 text-sm)
export const SUBTITLE_MARGIN = "0"; // m-0
export const SUBTITLE_FONT_SIZE = "0.875rem"; // text-sm = 0.875rem = 14px
export const SUBTITLE_LINE_HEIGHT = 1.25;

// Legacy exports for backward compatibility
export const BASE_PADDING = 16;

// Font family - use system font stack similar to Tailwind
export const FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Maximum height for key images
export const MAX_IMAGE_HEIGHT = 250;

export const EXTRA_BOTTOM_SPACING = 12;

// Gap between image and text
export const IMAGE_GAP = 4;

// Base height for nodes without images (estimated)
export const BASE_HEIGHT_NO_IMAGE = 100;

