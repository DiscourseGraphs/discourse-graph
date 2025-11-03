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
 * Uses actual DOM text measurement and image dimensions for accuracy. Matching Roam's approach.
 */
export const calcDiscourseNodeSize = async ({
  title,
  nodeTypeId,
  imageSrc,
  plugin,
}: CalcNodeSizeParams): Promise<{ w: number; h: number }> => {
  const nodeType = getNodeTypeById(plugin, nodeTypeId);
  const nodeTypeName = nodeType?.name || "";

  const { w, h: textHeight } = measureNodeText({
    title,
    subtitle: nodeTypeName,
  });

  if (!imageSrc || !nodeType?.keyImage) {
    return { w, h: textHeight };
  }

  try {
    const { width: imgWidth, height: imgHeight } = await loadImage(imageSrc);
    const aspectRatio = imgWidth / imgHeight;

    const effectiveWidth = w + BASE_PADDING;

    const imageHeight = Math.min(
      effectiveWidth / aspectRatio,
      MAX_IMAGE_HEIGHT,
    );

    let finalWidth = w;
    if (imageHeight === MAX_IMAGE_HEIGHT) {
      const imageWidth = MAX_IMAGE_HEIGHT * aspectRatio;
      const minWidthForImage = imageWidth + BASE_PADDING;
      if (minWidthForImage > w) {
        finalWidth = minWidthForImage;
      }
    }

    const totalHeight = BASE_PADDING + imageHeight + IMAGE_GAP + textHeight;

    return { w: finalWidth, h: totalHeight };
  } catch (error) {
    console.warn("calcDiscourseNodeSize: failed to load image", error);
    return { w, h: textHeight };
  }
};

