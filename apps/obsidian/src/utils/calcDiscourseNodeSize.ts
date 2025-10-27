import type DiscourseGraphPlugin from "~/index";
import { measureNodeText } from "./measureNodeText";
import { loadImage } from "./loadImage";
import {
  BASE_PADDING,
  MAX_IMAGE_HEIGHT,
  IMAGE_GAP,
} from "~/components/canvas/shapes/nodeConstants";
import { getNodeTypeById } from "./typeUtils";

type CalcNodeSizeParams = {
  title: string;
  nodeTypeId: string;
  imageSrc?: string;
  plugin: DiscourseGraphPlugin;
};

/**
 * Calculate the optimal dimensions for a discourse node shape.
 * Uses actual DOM text measurement and image dimensions for accuracy.
 *
 * This matches Roam's approach of measuring actual rendered content
 * rather than using hardcoded estimates.
 */
export const calcDiscourseNodeSize = async ({
  title,
  nodeTypeId,
  imageSrc,
  plugin,
}: CalcNodeSizeParams): Promise<{ w: number; h: number }> => {
  // Get node type to check if key images are enabled
  const nodeType = getNodeTypeById(plugin, nodeTypeId);
  const nodeTypeName = nodeType?.name || "";

  // Measure text dimensions (title + subtitle)
  const { w, h: textHeight } = measureNodeText({
    title,
    subtitle: nodeTypeName,
  });

  // If no image or key images not enabled, return text-only dimensions
  if (!imageSrc || !nodeType?.keyImage) {
    return { w, h: textHeight };
  }

  // Load image to get actual dimensions
  try {
    const { width: imgWidth, height: imgHeight } = await loadImage(imageSrc);
    const aspectRatio = imgWidth / imgHeight;

    // Calculate effective width (accounting for padding)
    // Use the measured text width as the base
    const effectiveWidth = w + BASE_PADDING;

    const imageHeight = Math.min(effectiveWidth / aspectRatio, MAX_IMAGE_HEIGHT);

    let finalWidth = w;
    if (imageHeight === MAX_IMAGE_HEIGHT) {
      const imageWidth = MAX_IMAGE_HEIGHT * aspectRatio;
      const minWidthForImage = imageWidth + BASE_PADDING;
      if (minWidthForImage > w) {
        finalWidth = minWidthForImage;
      }
    }

    // Total height: padding + image + gap + text
    const totalHeight = BASE_PADDING + imageHeight + IMAGE_GAP + textHeight;

    return { w: finalWidth, h: totalHeight };
  } catch (error) {
    // If image fails to load, fall back to text-only dimensions
    console.warn("calcDiscourseNodeSize: failed to load image", error);
    return { w, h: textHeight };
  }
};

