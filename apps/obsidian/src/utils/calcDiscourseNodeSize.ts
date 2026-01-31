import type DiscourseGraphPlugin from "~/index";
import { measureNodeText } from "./measureNodeText";
import { loadImage } from "./loadImage";
import {
  BASE_PADDING,
  EXTRA_BOTTOM_SPACING,
  IMAGE_GAP,
  MAX_IMAGE_HEIGHT,
} from "~/components/canvas/shapes/nodeConstants";
import { getNodeTypeById } from "./typeUtils";
import { TLDefaultSizeStyle, TLDefaultFontStyle } from "tldraw";

type CalcNodeSizeParams = {
  title: string;
  nodeTypeId: string;
  imageSrc?: string;
  plugin: DiscourseGraphPlugin;
  size?: TLDefaultSizeStyle;
  fontFamily?: TLDefaultFontStyle;
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
  size = "s",
  fontFamily = "draw",
}: CalcNodeSizeParams): Promise<{ w: number; h: number }> => {
  const nodeType = getNodeTypeById(plugin, nodeTypeId);

  const { w, h: textHeight } = measureNodeText({
    title,
    size,
    fontFamily,
  });

  if (!imageSrc || !nodeType?.keyImage) {
    return { w, h: textHeight + EXTRA_BOTTOM_SPACING };
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

    return {
      w: finalWidth,
      h: textHeight + imageHeight + IMAGE_GAP + EXTRA_BOTTOM_SPACING,
    };
  } catch (error) {
    console.warn("calcDiscourseNodeSize: failed to load image", error);
    return { w, h: textHeight };
  }
};

